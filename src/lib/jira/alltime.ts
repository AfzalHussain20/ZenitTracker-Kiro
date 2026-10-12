/**
 * Client-side access to the all-time Jira snapshot (/api/jira/alltime).
 *
 * The snapshot is fetched once per session (module-level memo) and served by
 * the browser HTTP cache afterwards, so it is never re-downloaded on every
 * navigation. Merge its result into a sync payload before processing KPIs.
 */
import { fetchApiJson } from './fetchJson';

export interface AllTimeSnapshot {
    allTimeBugs: any[];
    allTimeAll: any[];
}

let pending: Promise<AllTimeSnapshot | null> | null = null;

export function fetchAllTime(force = false): Promise<AllTimeSnapshot | null> {
    if (!force && pending) return pending;
    pending = fetchApiJson<AllTimeSnapshot>('/api/jira/alltime', { cache: force ? 'no-store' : 'default' })
        .then((snap) => (Array.isArray(snap?.allTimeBugs) && Array.isArray(snap?.allTimeAll) ? snap : null))
        .catch(() => null);
    return pending;
}

/** Attach the all-time snapshot to a raw sync payload (mutates and returns `raw`). */
export async function attachAllTime<T extends Record<string, any>>(raw: T): Promise<T> {
    const snap = await fetchAllTime();
    if (snap) {
        (raw as Record<string, any>).allTimeBugs = snap.allTimeBugs;
        (raw as Record<string, any>).allTimeAll = snap.allTimeAll;
    }
    return raw;
}