/**
 * Jira Worklogs API
 * Fetches work logs for all issues in the project.
 */

import { NextRequest, NextResponse } from 'next/server';

const JIRA_BASE = process.env.JIRA_BASE_URL!;
const JIRA_AUTH = () => Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString('base64');
const PROJECT_KEY = process.env.JIRA_PROJECT_KEY || 'SUN';

// Cache worklogs for 15 minutes
const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 15 * 60 * 1000;

async function fetchWorklogsForIssue(issueKey: string) {
    const url = `${JIRA_BASE}/rest/api/3/issue/${issueKey}/worklog`;
    const res = await fetch(url, {
        headers: { Authorization: `Basic ${JIRA_AUTH()}`, Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.worklogs || []).map((w: any) => ({
        issueKey,
        issueUrl: `${JIRA_BASE}/browse/${issueKey}`,
        author: w.author?.displayName || 'Unknown',
        authorId: w.author?.accountId || '',
        timeSpentSeconds: w.timeSpentSeconds || 0,
        timeSpent: w.timeSpent || '0m',
        started: w.started,
        comment: w.comment?.content?.[0]?.content?.[0]?.text || '',
    }));
}

// GET: fetch worklogs for issues updated in the last N days
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get('days') || '30');
    const cacheKey = `worklogs_${days}`;

    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
        return NextResponse.json({ ...cached.data, fromCache: true });
    }

    try {
        // Paginate through ALL issues with worklogs in the period
        const jql = encodeURIComponent(`project = ${PROJECT_KEY} AND worklogDate >= -${days}d ORDER BY updated DESC`);
        let startAt = 0;
        const pageSize = 100;
        const allIssues: any[] = [];

        while (true) {
            const url = `${JIRA_BASE}/rest/api/3/search/jql?jql=${jql}&maxResults=${pageSize}&startAt=${startAt}&fields=summary,issuetype,status`;
            const res = await fetch(url, {
                headers: { Authorization: `Basic ${JIRA_AUTH()}`, Accept: 'application/json' },
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                return NextResponse.json({ error: err.errorMessages?.[0] || 'Failed' }, { status: res.status });
            }
            const data = await res.json();
            const batch = data.issues || [];
            allIssues.push(...batch);
            if (allIssues.length >= data.total || batch.length < pageSize) break;
            startAt += pageSize;
            // Safety cap at 500 issues to avoid timeout
            if (allIssues.length >= 500) break;
        }

        const issues = allIssues;

        // Fetch detailed worklogs for each issue in parallel batches
        const BATCH = 20;
        const allWorklogArrays: any[][] = [];
        for (let i = 0; i < issues.length; i += BATCH) {
            const batch = issues.slice(i, i + BATCH);
            const results = await Promise.all(batch.map((issue: any) => fetchWorklogsForIssue(issue.key)));
            allWorklogArrays.push(...results);
        }
        const worklogPromises = allWorklogArrays;

        const worklogArrays = worklogPromises;
        const allWorklogs = worklogArrays.flat();

        // Aggregate by user
        const byUser = new Map<string, {
            authorId: string;
            author: string;
            totalSeconds: number;
            logCount: number;
            issues: Set<string>;
        }>();

        allWorklogs.forEach(w => {
            if (!byUser.has(w.authorId)) {
                byUser.set(w.authorId, {
                    authorId: w.authorId,
                    author: w.author,
                    totalSeconds: 0,
                    logCount: 0,
                    issues: new Set(),
                });
            }
            const entry = byUser.get(w.authorId)!;
            entry.totalSeconds += w.timeSpentSeconds;
            entry.logCount++;
            entry.issues.add(w.issueKey);
        });

        const userSummary = Array.from(byUser.values())
            .map(u => ({
                authorId: u.authorId,
                author: u.author,
                totalSeconds: u.totalSeconds,
                totalHours: Math.round(u.totalSeconds / 3600 * 10) / 10,
                logCount: u.logCount,
                issueCount: u.issues.size,
            }))
            .sort((a, b) => b.totalSeconds - a.totalSeconds);

        const result = {
            worklogs: allWorklogs,
            byUser: userSummary,
            totalIssuesWithLogs: issues.length,
            syncedAt: new Date().toISOString(),
        };

        cache.set(cacheKey, { data: result, ts: Date.now() });
        return NextResponse.json({ ...result, fromCache: false });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
