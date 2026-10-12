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

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes — reduced API calls, data rarely changes mid-session

interface CacheEntry { data: any; ts: number; fetching: boolean; }
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

// GET: return cached data immediately, refresh in background if stale
export async function GET(req: NextRequest) {
    const sprintIdParam = req.nextUrl.searchParams.get('sprintId');
    const parsedSprintId = toPositiveInt(sprintIdParam);
    // Never splice an unvalidated value into JQL — unknown/invalid IDs fall back to auto-detect.
    const sprintId = parsedSprintId ? String(parsedSprintId) : undefined;
    // Cache key includes sprint ID — different sprints have separate caches
    const key = `full_sync_${sprintId || 'auto'}`;
    const entry = cache.get(key);
    const now = Date.now();
    const isStale = !entry || (now - entry.ts) >= CACHE_TTL;

    // If we have data (even stale), return it immediately
    if (entry?.data) {
        // Trigger background refresh if stale and not already fetching
        if (isStale && !entry.fetching) {
            cache.set(key, { ...entry, fetching: true });
            buildFullSync(sprintId).then(data => {
                cache.set(key, { data, ts: Date.now(), fetching: false });
                console.log('[Sync] Background refresh complete');
            }).catch(err => {
                cache.set(key, { ...entry, fetching: false });
                console.error('[Sync] Background refresh failed:', err.message);
            });
        }

        return NextResponse.json({
            ...entry.data,
            cacheAge: Math.round((now - entry.ts) / 1000),
            nextRefresh: Math.max(0, Math.round((CACHE_TTL - (now - entry.ts)) / 1000)),
            fromCache: true,
            refreshing: isStale && entry.fetching,
        });
    }

    // No cache at all — must fetch synchronously (first load)
    if (!entry?.fetching) {
        cache.set(key, { data: null, ts: 0, fetching: true });
    }

    try {
        const data = await buildFullSync(sprintId);
        cache.set(key, { data, ts: now, fetching: false });
        return NextResponse.json({ ...data, cacheAge: 0, nextRefresh: CACHE_TTL / 1000, fromCache: false });
    } catch (err: any) {
        cache.set(key, { data: null, ts: 0, fetching: false });
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
        cache.set(key, { data: cache.get(key)?.data || null, ts: 0, fetching: true });
        const data = await buildFullSync(sprintId);
        cache.set(key, { data, ts: Date.now(), fetching: false });
        return NextResponse.json({ ...data, fromCache: false, forced: true });
    } catch (err: any) {
        cache.set(key, { data: cache.get(key)?.data || null, ts: 0, fetching: false });
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
