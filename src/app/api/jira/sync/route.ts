/**
 * Jira Sync API — Server-side cache with background refresh
 * - Fetches ALL issue types in true parallel (no sequential delays)
 * - Caches 10 minutes server-side
 * - Returns stale data immediately while refreshing in background
 * - Includes story points, assigned tickets, live build status
 */

import { NextRequest, NextResponse } from 'next/server';
import { toPositiveInt } from '@/lib/jira/jql';
import { PROJECT_KEY, JIRA_AUTH, fetchAllPages } from '@/lib/jira/sync-data';
import { getCloudflareContext } from '@opennextjs/cloudflare';

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes — reduced API calls, data rarely changes mid-session
const CACHE_TTL_SECONDS = Math.round(CACHE_TTL / 1000) + 60; // KV expiry (slight buffer)

// In-memory cache only survives the lifetime of an isolate — Cloudflare recycles
// idle isolates, so the same payload is ALSO persisted to KV (gzip bytes + ts)
// to survive across restarts and make every navigation fast.
const KV_PREFIX = 'syncv2:';
interface CacheEntry { gz: Uint8Array; ts: number; fetching: boolean; }
const cache = new Map<string, CacheEntry>();

async function buildFullSync(sprintId?: string) {
    const start = Date.now();
    // Sprint clause: exact sprint ID if provided, else active sprint only
    // Using openSprints() can return multiple sprints — use exact ID for accuracy
    let resolvedSprintId = sprintId;
    if (!resolvedSprintId) {
        // Auto-detect the active sprint ID from the Agile API
        try {
            const boardsRes = await fetch(
                `${JIRA_BASE}/rest/agile/1.0/board?projectKeyOrId=${PROJECT_KEY}&maxResults=10`,
                { headers: { Authorization: `Basic ${JIRA_AUTH()}`, Accept: 'application/json' }, cache: 'no-store' }
            );
            if (boardsRes.ok) {
                const boardsData = await boardsRes.json();
                const boards: any[] = boardsData.values || [];
                for (const board of boards) {
                    const sprintRes = await fetch(
                        `${JIRA_BASE}/rest/agile/1.0/board/${board.id}/sprint?state=active&maxResults=1`,
                        { headers: { Authorization: `Basic ${JIRA_AUTH()}`, Accept: 'application/json' }, cache: 'no-store' }
                    );
                    if (sprintRes.ok) {
                        const sprintData = await sprintRes.json();
                        const activeSprint = sprintData.values?.[0];
                        if (activeSprint?.id) {
                            resolvedSprintId = String(activeSprint.id);
                            console.log(`[Sync] Auto-detected active sprint: ${activeSprint.name} (ID: ${resolvedSprintId})`);
                            break;
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('[Sync] Could not auto-detect active sprint, falling back to openSprints()');
        }
    }

    const sprintClause = resolvedSprintId
        ? `AND sprint = ${resolvedSprintId}`
        : `AND sprint in openSprints()`;

    console.log(`[Sync] Starting parallel Jira sync... sprint=${resolvedSprintId || 'openSprints()'}`);

    // Fetch all issue types in parallel (sprint-scoped only)
    // Live subrequests stay under Cloudflare's free-plan cap (50); the all-time
    // dataset is fetched outside the worker and served from the R2 snapshot.
    const [bugs, stories, epics, tasks, subtasks] = await Promise.all([
        fetchAllPages(`project = ${PROJECT_KEY} ${sprintClause} AND issuetype = "Bug" ORDER BY created DESC`),
        fetchAllPages(`project = ${PROJECT_KEY} ${sprintClause} AND issuetype = "Story" ORDER BY created DESC`),
        fetchAllPages(`project = ${PROJECT_KEY} ${sprintClause} AND issuetype = "Epic" ORDER BY created DESC`),
        fetchAllPages(`project = ${PROJECT_KEY} ${sprintClause} AND issuetype = "Task" ORDER BY created DESC`),
        fetchAllPages(`project = ${PROJECT_KEY} ${sprintClause} AND issuetype = "Sub-task" ORDER BY created DESC`),
    ]);

    const all = [...bugs, ...stories, ...epics, ...tasks, ...subtasks];
    // allForSP excludes sub-tasks — sub-tasks duplicate parent story SP
    const allForSP = [...bugs, ...stories, ...epics, ...tasks];
    const elapsed = Date.now() - start;

    // Live build tickets = any issue with a released fix version
    const liveTickets = all.filter(i => i.isLive);

    console.log(`[Sync] Done in ${elapsed}ms: ${all.length} total (bugs=${bugs.length}, stories=${stories.length}, epics=${epics.length}, tasks=${tasks.length}, subtasks=${subtasks.length}, live=${liveTickets.length})`);

    return {
        all, bugs, stories, epics, tasks, subtasks, allForSP,
        liveTickets,
        syncedAt: new Date().toISOString(),
        syncDurationMs: elapsed,
        sprintId: resolvedSprintId || null,
        spByType: {
            tasks:   tasks.reduce((s: number, i: any) => s + (i.storyPoints || 0), 0),
            bugs:    bugs.reduce((s: number, i: any) => s + (i.storyPoints || 0), 0),
            stories: stories.reduce((s: number, i: any) => s + (i.storyPoints || 0), 0),
            epics:   epics.reduce((s: number, i: any) => s + (i.storyPoints || 0), 0),
        },
        counts: {
            total: all.length,
            bugs: bugs.length,
            stories: stories.length,
            epics: epics.length,
            tasks: tasks.length,
            subtasks: subtasks.length,
            live: liveTickets.length,
        },
    };
}

// ─── Compressed + KV-persisted cache ──────────────────────────────────────────
// The full sprint payload (~6.7 MB JSON) is gzipped ONCE per cache fill and the
// bytes stored — per-request CPU is ~zero (just piping stored bytes), which
// keeps us well under the free plan's resource limit. Volatile meta (cache age,
// refreshing) travels in headers instead of the body so the body stays immutable.

function alltimeKV(): any | undefined {
    try {
        const { env } = getCloudflareContext();
        return (env as any)?.ALLTIME_KV;
    } catch {
        return undefined;
    }
}

async function kvGet(key: string): Promise<CacheEntry | null> {
    try {
        const kv = alltimeKV();
        if (!kv) return null;
        const raw = await kv.get(KV_PREFIX + key);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { ts: number; gzB64: string };
        const gz = new Uint8Array(Buffer.from(parsed.gzB64, 'base64'));
        return { gz, ts: parsed.ts, fetching: false };
    } catch {
        return null;
    }
}

async function kvPut(key: string, entry: CacheEntry) {
    try {
        const kv = alltimeKV();
        if (!kv) return;
        const gzB64 = Buffer.from(entry.gz).toString('base64');
        await kv.put(KV_PREFIX + key, JSON.stringify({ ts: entry.ts, gzB64 }), { expirationTtl: CACHE_TTL_SECONDS });
    } catch {
        // Persistence is best-effort — in-memory cache still serves this isolate.
    }
}

async function compressPayload(payload: any): Promise<Uint8Array> {
    const cs = new CompressionStream('gzip');
    const stream = new Blob([JSON.stringify(payload)]).stream().pipeThrough(cs);
    const buf = await new Response(stream).arrayBuffer();
    return new Uint8Array(buf);
}

async function fill(key: string, data: any, ts: number): Promise<CacheEntry> {
    const gz = await compressPayload(data);
    const entry: CacheEntry = { gz, ts, fetching: false };
    cache.set(key, entry);
    await kvPut(key, entry);
    return entry;
}

function respondEntry(entry: CacheEntry, now: number, extra: Record<string, string | number | boolean> = {}) {
    const cacheAge = Math.round((now - entry.ts) / 1000);
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store', // sprint data freshness is handled server-side; meta lives in headers
        'X-Cache-Age': String(cacheAge),
        'X-Next-Refresh': String(Math.max(0, Math.round((CACHE_TTL - (now - entry.ts)) / 1000))),
        'X-From-Cache': '1',
        'X-Force-Refresh': '0',
    };
    for (const [k, v] of Object.entries(extra)) headers[k] = String(v);
    return new Response(entry.gz, { status: 200, headers });
}

// GET: return (KV- or memory-)cached payload immediately, refresh in background if stale
export async function GET(req: NextRequest) {
    const sprintIdParam = req.nextUrl.searchParams.get('sprintId');
    const parsedSprintId = toPositiveInt(sprintIdParam);
    // Never splice an unvalidated value into JQL — unknown/invalid IDs fall back to auto-detect.
    const sprintId = parsedSprintId ? String(parsedSprintId) : undefined;
    // Cache key includes sprint ID — different sprints have separate caches
    const key = `full_sync_${sprintId || 'auto'}`;
    let entry = cache.get(key);
    const now = Date.now();
    if (!entry) {
        entry = await kvGet(key);
        if (entry) cache.set(key, entry);
    }

    const isStale = !entry || (now - entry.ts) >= CACHE_TTL;

    // Have a payload (even stale) — return it immediately, refresh in background
    if (entry?.gz?.length) {
        if (isStale && !entry.fetching) {
            const prev = { ...entry, fetching: true };
            cache.set(key, prev);
            buildFullSync(sprintId).then(async data => {
                await fill(key, data, Date.now());
                console.log('[Sync] Background refresh complete');
            }).catch(err => {
                cache.set(key, { ...prev, fetching: false });
                console.error('[Sync] Background refresh failed:', err.message);
            });
        }

        return respondEntry(entry, now, { 'X-Refreshing': (isStale && entry.fetching) ? '1' : '0' });
    }

    // No cached payload — must fetch synchronously (first load / stale KV miss)
    if (!entry?.fetching) {
        cache.set(key, { gz: new Uint8Array(0), ts: 0, fetching: true });
    }

    try {
        const data = await buildFullSync(sprintId);
        const filled = await fill(key, data, Date.now());
        return respondEntry(filled, Date.now(), { 'X-From-Cache': '0', 'X-Refreshing': '0' });
    } catch (err: any) {
        cache.delete(key);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// POST: force immediate refresh
export async function POST(req: NextRequest) {
    const sprintIdParam = req.nextUrl.searchParams.get('sprintId');
    const parsedSprintId = toPositiveInt(sprintIdParam);
    // Never splice an unvalidated value into JQL — unknown/invalid IDs fall back to auto-detect.
    const sprintId = parsedSprintId ? String(parsedSprintId) : undefined;
    const key = `full_sync_${sprintId || 'auto'}`;
    try {
        cache.set(key, { gz: new Uint8Array(0), ts: 0, fetching: true });
        const data = await buildFullSync(sprintId);
        const filled = await fill(key, data, Date.now());
        return respondEntry(filled, Date.now(), { 'X-From-Cache': '0', 'X-Force-Refresh': '1' });
    } catch (err: any) {
        cache.delete(key);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
