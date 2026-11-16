/**
 * Client-side access to the all-time Jira snapshot (/api/jira/alltime).
 *
 * The snapshot is rebuilt every 15 minutes by the refresh-alltime workflow.
 * We memoise it for a short window (instead of forever) so a long-lived tab —
 * or the dashboard's live polling — actually sees bugs reported after the page
 * first loaded. `force` bypasses both the memo and the browser HTTP cache.
 */
import { fetchApiJson } from './fetchJson';

export interface AllTimeSnapshot {
    allTimeBugs: any[];
    allTimeAll: any[];
    builtAt?: string;
    total?: number;
}

/** How long a memoised snapshot is considered fresh. */
const MEMO_TTL_MS = 60 * 1000;

let pending: Promise<AllTimeSnapshot | null> | null = null;
let pendingAt = 0;

export function fetchAllTime(force = false): Promise<AllTimeSnapshot | null> {
    const now = Date.now();
    if (!force && pending && now - pendingAt < MEMO_TTL_MS) return pending;

    pendingAt = now;
    // `force` must also bypass the browser cache, not just the module memo.
    const url = force ? `/api/jira/alltime?fresh=${now}` : '/api/jira/alltime';
    pending = fetchApiJson<AllTimeSnapshot>(url, { cache: force ? 'no-store' : 'default' })
        .then((snap) => (Array.isArray(snap?.allTimeBugs) && Array.isArray(snap?.allTimeAll) ? snap : null))
        .catch(() => null);
    return pending;
}

/** Attach the all-time snapshot to a raw sync payload (mutates and returns `raw`). */
export async function attachAllTime<T extends Record<string, any>>(raw: T, force = false): Promise<T> {
    const snap = await fetchAllTime(force);
    if (snap) {
        (raw as Record<string, any>).allTimeBugs = snap.allTimeBugs;
        (raw as Record<string, any>).allTimeAll = snap.allTimeAll;
        (raw as Record<string, any>).allTimeBuiltAt = snap.builtAt ?? null;
    }
    return raw;
}
