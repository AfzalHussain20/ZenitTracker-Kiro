/**
 * Client-side access to the all-time Jira snapshot (/api/jira/alltime).
 *
 * The snapshot is rebuilt every 15 minutes by the refresh-alltime workflow.
 * We memoise it for a short window (instead of forever) so a long-lived tab —
 * or the dashboard's live polling — actually sees bugs reported after the page
 * first loaded. `force` bypasses both the memo and the browser HTTP cache.
 */
import { fetchApiJson } from './fetchJson';
import { fetchRecentIssues } from './recent';

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

function laterIso(a: string | null | undefined, b: string | null | undefined): string | null {
    if (!a) return b ?? null;
    if (!b) return a;
    return Date.parse(a) >= Date.parse(b) ? a : b;
}

/**
 * Attach the all-time snapshot to a raw sync payload (mutates and returns `raw`).
 *
 * A small live "recent" window is overlaid on the snapshot so today's and
 * yesterday's counts do not depend on the scheduled rebuild being on time.
 * Issues are deduplicated by id, so the overlay can never double-count.
 */
export async function attachAllTime<T extends Record<string, any>>(raw: T, force = false): Promise<T> {
    const [snap, recent] = await Promise.all([
        fetchAllTime(force),
        fetchRecentIssues(7, force),
    ]);

    if (!snap) return raw;

    const mergedBugs = [...snap.allTimeBugs];
    const mergedAll = [...snap.allTimeAll];
    const bugIds = new Set(mergedBugs.map((i: any) => i.id));
    const allIds = new Set(mergedAll.map((i: any) => i.id));

    (recent?.issues || []).forEach((issue: any) => {
        if (issue?.issueType === 'Bug' && !bugIds.has(issue.id)) {
            mergedBugs.push(issue);
            bugIds.add(issue.id);
        }
        if (!allIds.has(issue.id)) {
            mergedAll.push(issue);
            allIds.add(issue.id);
        }
    });

    (raw as Record<string, any>).allTimeBugs = mergedBugs;
    (raw as Record<string, any>).allTimeAll = mergedAll;
    (raw as Record<string, any>).allTimeBuiltAt = laterIso(snap.builtAt, recent?.fetchedAt);
    return raw;
}
