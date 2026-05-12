/**
 * useWorklogs — Fetches Jira worklog hours per user
 * Fetches last 400 days of worklogs once, then filters client-side by period
 */

import { useState, useEffect, useCallback } from 'react';

export interface WorklogEntry {
    issueKey: string;
    author: string;
    authorId: string;
    timeSpentSeconds: number;
    timeSpent: string;
    started: string; // ISO date string e.g. "2026-04-15T10:00:00.000+0000"
}

export interface WorklogUser {
    authorId: string;
    author: string;
    totalSeconds: number;
    totalHours: number;
    logCount: number;
    issueCount: number;
}

export interface WorklogData {
    worklogs: WorklogEntry[];
    byUser: WorklogUser[];
    totalIssuesWithLogs: number;
    syncedAt: string;
    fromCache: boolean;
}

// Filter raw worklogs by a specific month key "YYYY-MM" or year "YYYY"
export function filterWorklogsByPeriod(
    worklogs: WorklogEntry[],
    period: 'monthly' | 'yearly',
    key: string // "2026-04" for monthly, "2026" for yearly
): WorklogUser[] {
    const filtered = worklogs.filter(w => {
        if (!w.started) return false;
        // Jira started format: "2026-04-15T10:00:00.000+0000" or "2026-04-15T10:00:00.000+0530"
        // Take first 7 chars for YYYY-MM
        const dateStr = w.started.slice(0, 7);
        return period === 'monthly' ? dateStr === key : dateStr.startsWith(key);
    });

    const byUser = new Map<string, { authorId: string; author: string; totalSeconds: number; logCount: number; issues: Set<string> }>();
    filtered.forEach(w => {
        if (!byUser.has(w.authorId)) {
            byUser.set(w.authorId, { authorId: w.authorId, author: w.author, totalSeconds: 0, logCount: 0, issues: new Set() });
        }
        const entry = byUser.get(w.authorId)!;
        entry.totalSeconds += w.timeSpentSeconds;
        entry.logCount++;
        entry.issues.add(w.issueKey);
    });

    return Array.from(byUser.values()).map(u => ({
        authorId: u.authorId,
        author: u.author,
        totalSeconds: u.totalSeconds,
        totalHours: Math.round(u.totalSeconds / 3600 * 10) / 10,
        logCount: u.logCount,
        issueCount: u.issues.size,
    }));
}

export function useWorklogs() {
    const [data, setData] = useState<WorklogData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetch_ = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Fetch last 400 days to cover full year + some buffer
            const res = await fetch(`/api/jira/worklogs?days=400`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            if (json.error) throw new Error(json.error);
            setData(json);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetch_();
    }, [fetch_]);

    return { data, loading, error, refetch: fetch_ };
}
