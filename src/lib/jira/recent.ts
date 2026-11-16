/**
 * Client-side access to the live "recent issues" window (/api/jira/recent).
 *
 * The all-time snapshot can lag behind Jira when the scheduled rebuild is
 * delayed. This overlay carries the last few days of issues so today's and
 * yesterday's counts are exact. Short memo; `force` bypasses it and the HTTP
 * cache.
 */
import { fetchApiJson } from './fetchJson';

export interface RecentIssues {
    issues: any[];
    fetchedAt: string;
}

const MEMO_TTL_MS = 60 * 1000;
let pending: Promise<RecentIssues | null> | null = null;
let pendingAt = 0;

export function fetchRecentIssues(days = 7, force = false): Promise<RecentIssues | null> {
    const now = Date.now();
    if (!force && pending && now - pendingAt < MEMO_TTL_MS) return pending;

    pendingAt = now;
    const url = force
        ? `/api/jira/recent?days=${days}&fresh=${now}`
        : `/api/jira/recent?days=${days}`;
    pending = fetchApiJson<RecentIssues>(url, { cache: force ? 'no-store' : 'default' })
        .then((res) => (Array.isArray(res?.issues) ? res : null))
        .catch(() => null);
    return pending;
}
