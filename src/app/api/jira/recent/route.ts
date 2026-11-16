/**
 * GET /api/jira/recent?days=7 — small, live Jira query for the newest issues.
 *
 * The all-time snapshot is rebuilt by a GitHub Actions schedule, which GitHub
 * can delay by hours. Daily counts ("today", "yesterday") must not depend on
 * that schedule, so the dashboard overlays this live window on top of the
 * snapshot: only the last few days are queried, which is a handful of Jira
 * pages and stays far below the Worker subrequest budget.
 *
 * Cached in-memory per isolate and in KV for 10 minutes.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { PROJECT_KEY, ALLTIME_FIELDS, fetchAllPages } from '@/lib/jira/sync-data';

const TTL_MS = 10 * 60 * 1000;
const KV_PREFIX = 'recentv1:';

interface Cached { issues: any[]; fetchedAt: string; ts: number; }
const memo = new Map<string, Cached>();

function json(entry: Cached) {
    return NextResponse.json(
        { issues: entry.issues, fetchedAt: entry.fetchedAt },
        { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } }
    );
}

export async function GET(req: NextRequest) {
    const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get('days') || 7) || 7, 1), 30);
    const key = `${KV_PREFIX}${days}`;
    const now = Date.now();

    const hit = memo.get(key);
    if (hit && now - hit.ts < TTL_MS) return json(hit);

    // KV survives isolate recycling, so a cold start still avoids a Jira call.
    let kv: any = null;
    try {
        const { env } = getCloudflareContext();
        kv = (env as any)?.ALLTIME_KV ?? null;
        if (kv) {
            const stored: Cached | null = await kv.get(key, 'json');
            if (stored && now - stored.ts < TTL_MS) {
                memo.set(key, stored);
                return json(stored);
            }
        }
    } catch {
        // KV unavailable (local dev) — fall through to Jira.
    }

    try {
        const issues = await fetchAllPages(
            `project = ${PROJECT_KEY} AND created >= -${days}d ORDER BY created DESC`,
            ALLTIME_FIELDS.join(',')
        );
        const entry: Cached = { issues, fetchedAt: new Date().toISOString(), ts: now };
        memo.set(key, entry);
        if (kv) {
            try {
                await kv.put(key, JSON.stringify(entry), { expirationTtl: Math.round(TTL_MS / 1000) * 3 });
            } catch {
                // A failed write only costs one extra Jira call later.
            }
        }
        return json(entry);
    } catch (err: any) {
        // If Jira fails, serve whatever stale copy KV has rather than an error.
        if (kv) {
            try {
                const stored: Cached | null = await kv.get(key, 'json');
                if (stored) return json(stored);
            } catch { /* ignore */ }
        }
        return NextResponse.json({ error: err?.message || 'recent fetch failed' }, { status: 502 });
    }
}
