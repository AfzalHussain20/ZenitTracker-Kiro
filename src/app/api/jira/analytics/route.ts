/**
 * Jira Analytics Route — now delegates to the sync cache
 * Returns pre-computed analytics from the server-side sync cache.
 * No more 500-issue limit. No more deprecated POST endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';

const JIRA_BASE = process.env.JIRA_BASE_URL!;
const JIRA_AUTH = () => Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString('base64');
const PROJECT_KEY = process.env.JIRA_PROJECT_KEY || 'SUN';

const FIELDS = [
    'summary', 'status', 'priority', 'assignee', 'reporter',
    'created', 'updated', 'resolutiondate', 'issuetype', 'labels',
    'customfield_10103', 'customfield_10201', 'customfield_10237',
];

// Cursor-based pagination — no artificial limit
async function fetchAll(): Promise<any[]> {
    const all: any[] = [];
    let nextPageToken: string | null = null;
    const encodedJql = encodeURIComponent(`project = ${PROJECT_KEY} ORDER BY created DESC`);
    const fieldsParam = FIELDS.join(',');

    while (true) {
        let url = `${JIRA_BASE}/rest/api/3/search/jql?jql=${encodedJql}&maxResults=100&fields=${fieldsParam}`;
        if (nextPageToken) url += `&nextPageToken=${encodeURIComponent(nextPageToken)}`;

        const res = await fetch(url, {
            headers: { Authorization: `Basic ${JIRA_AUTH()}`, Accept: 'application/json' },
            cache: 'no-store',
        });

        if (!res.ok) break;
        const data = await res.json();
        all.push(...(data.issues || []));
        if (data.isLast || !data.nextPageToken) break;
        nextPageToken = data.nextPageToken;
    }

    return all;
}

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, number> {
    return arr.reduce((acc, item) => {
        const k = key(item) || 'Unknown';
        acc[k] = (acc[k] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
}

function toChartData(obj: Record<string, number>, limit = 20) {
    return Object.entries(obj)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([name, value]) => ({ name, value }));
}

// Cache to avoid re-fetching on every dashboard load
let analyticsCache: { data: any; ts: number } | null = null;
const CACHE_TTL = 10 * 60 * 1000;

export async function GET(_req: NextRequest) {
    try {
        const now = Date.now();
        if (analyticsCache && (now - analyticsCache.ts) < CACHE_TTL) {
            return NextResponse.json({ ...analyticsCache.data, fromCache: true });
        }

        const issues = await fetchAll();
        const bugs = issues.filter(i => i.fields.issuetype?.name === 'Bug');

        const byStatus = groupBy(issues, i => i.fields.status?.name);
        const byStatusBugs = groupBy(bugs, i => i.fields.status?.name);
        const byPriority = groupBy(issues, i => i.fields.priority?.name);
        const byPriorityBugs = groupBy(bugs, i => i.fields.priority?.name);
        const byPlatform = groupBy(issues.filter(i => i.fields.customfield_10103?.length), i => i.fields.customfield_10103[0]?.value || 'Unknown');
        const byEnvironment = groupBy(issues.filter(i => i.fields.customfield_10201?.length), i => i.fields.customfield_10201[0] || 'Unknown');
        const byType = groupBy(issues, i => i.fields.issuetype?.name);
        const byAssignee = groupBy(issues.filter(i => i.fields.assignee), i => i.fields.assignee.displayName);
        const bugsByAssignee = groupBy(bugs.filter(i => i.fields.assignee), i => i.fields.assignee.displayName);
        const byReporter = groupBy(issues.filter(i => i.fields.reporter), i => i.fields.reporter.displayName);
        const existingInLive = groupBy(issues.filter(i => i.fields.customfield_10237?.length), i => i.fields.customfield_10237[0] || 'Unknown');

        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const createdByDay: Record<string, number> = {};
        issues.filter(i => new Date(i.fields.created) >= thirtyDaysAgo).forEach(i => {
            const day = i.fields.created.substring(0, 10);
            createdByDay[day] = (createdByDay[day] || 0) + 1;
        });
        const trendData = Object.entries(createdByDay)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([date, count]) => ({ date: date.substring(5), count }));

        const OPEN = new Set(['Open', 'To Do', 'New', 'Reopen']);
        const CLOSED = new Set(['Done', 'Closed', 'completed', 'Live', 'Fixed', 'Infra Completed', 'Dev Completed', 'Resolved', 'QA Verified', 'By Design']);
        const openCount = issues.filter(i => OPEN.has(i.fields.status?.name)).length;
        const closedCount = issues.filter(i => CLOSED.has(i.fields.status?.name)).length;
        const openBugs = bugs.filter(i => OPEN.has(i.fields.status?.name)).length;
        const highestPriority = issues.filter(i => i.fields.priority?.name === 'Highest').length;
        const inProgress = issues.filter(i => i.fields.status?.name === 'Inprogress' || i.fields.status?.name === 'In Progress').length;

        const result = {
            kpis: {
                totalIssues: issues.length,
                totalBugs: bugs.length,
                openBugs, openCount, closedCount, highestPriority, inProgress,
            },
            charts: {
                byStatus: toChartData(byStatus),
                byStatusBugs: toChartData(byStatusBugs),
                byPriority: toChartData(byPriority),
                byPriorityBugs: toChartData(byPriorityBugs),
                byPlatform: toChartData(byPlatform),
                byEnvironment: toChartData(byEnvironment),
                byType: toChartData(byType),
                byAssignee: toChartData(byAssignee),
                bugsByAssignee: toChartData(bugsByAssignee),
                byReporter: toChartData(byReporter),
                trendData,
                existingInLive: toChartData(existingInLive),
            },
            lastUpdated: new Date().toISOString(),
        };

        analyticsCache = { data: result, ts: now };
        return NextResponse.json(result);
    } catch (err: any) {
        console.error('Analytics error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
