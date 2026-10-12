/**
 * Jira Worklogs API
 * Fetches work logs for all issues in the project.
 */

import { NextRequest, NextResponse } from 'next/server';
import { toPositiveInt } from '@/lib/jira/jql';

const JIRA_BASE = process.env.JIRA_BASE_URL!;
const JIRA_AUTH = () => Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString('base64');
const PROJECT_KEY = process.env.JIRA_PROJECT_KEY || 'SUN';

// Cache worklogs for 15 minutes
const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 15 * 60 * 1000;

async function fetchWorklogsForIssue(issueKey: string, startedAfter: string) {
    const url = `${JIRA_BASE}/rest/api/3/issue/${issueKey}/worklog?started=${encodeURIComponent(startedAfter)}&maxResults=1000`;
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
    const days = Math.min(toPositiveInt(searchParams.get('days')) ?? 30, 3650);
    const cacheKey = `worklogs_${days}`;

    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
        return NextResponse.json({ ...cached.data, fromCache: true });
    }

    try {
        // Paginate with the cursor API — /search/jql ignores startAt and returns
        // the same first page forever, which previously produced duplicate issues.
        const jql = encodeURIComponent(`project = ${PROJECT_KEY} AND worklogDate >= -${days}d ORDER BY updated DESC`);
        let nextPageToken: string | undefined;
        const allIssues: any[] = [];

        do {
            let url = `${JIRA_BASE}/rest/api/3/search/jql?jql=${jql}&maxResults=100&fields=summary,issuetype,status`;
            if (nextPageToken) url += `&nextPageToken=${encodeURIComponent(nextPageToken)}`;
            const res = await fetch(url, {
                headers: { Authorization: `Basic ${JIRA_AUTH()}`, Accept: 'application/json' },
                cache: 'no-store',
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                return NextResponse.json({ error: err.errorMessages?.[0] || 'Failed' }, { status: res.status });
            }
            const data = await res.json();
            allIssues.push(...(data.issues || []));
            nextPageToken = data.isLast ? undefined : data.nextPageToken;
            // Safety cap at 500 issues to avoid timeout
        } while (nextPageToken && allIssues.length < 500);

        const issues = allIssues;

        // The JQL only guarantees each issue was *touched* recently — an issue can
        // carry years of worklogs, so window the per-issue fetch too.
        const windowStart = Date.now() - days * 86400000;
        const startedAfter = new Date(windowStart).toISOString().replace(/\.\d{3}Z$/, '+0000');

        // Fetch detailed worklogs for each issue in parallel batches
        const BATCH = 20;
        const allWorklogArrays: any[][] = [];
        for (let i = 0; i < issues.length; i += BATCH) {
            const batch = issues.slice(i, i + BATCH);
            const results = await Promise.all(batch.map((issue: any) => fetchWorklogsForIssue(issue.key, startedAfter)));
            allWorklogArrays.push(...results);
        }

        const allWorklogs = allWorklogArrays.flat().filter(w => {
            if (!w.started) return false;
            const t = new Date(w.started).getTime();
            return !Number.isNaN(t) && t >= windowStart;
        });

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

const ISSUE_KEY_RE = /^[A-Z][A-Z0-9_]*-\d+$/;

/**
 * POST: create a worklog on a Jira issue.
 *
 * NOTE: This integration authenticates with a Jira API token (Basic auth), which
 * cannot log work *as* another user — Jira ignores any author override. The worklog
 * is therefore attributed to the integration account; when `loggedForName` is
 * supplied it is embedded into the comment so the intent stays visible.
 */
export async function POST(req: NextRequest) {
    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const issueKey = String(body?.issueKey || '').trim().toUpperCase();
    const timeSpentSeconds = Number(body?.timeSpentSeconds);
    const rawComment = typeof body?.comment === 'string' ? body.comment.trim() : '';
    const loggedForName = typeof body?.loggedForName === 'string' ? body.loggedForName.trim() : '';
    const started = typeof body?.started === 'string' ? body.started.trim() : '';

    if (!ISSUE_KEY_RE.test(issueKey)) {
        return NextResponse.json({ error: 'A valid issue key is required (e.g. SUN-123)' }, { status: 400 });
    }
    if (!Number.isFinite(timeSpentSeconds) || timeSpentSeconds <= 0 || timeSpentSeconds > 60 * 60 * 24 * 30) {
        return NextResponse.json({ error: 'timeSpentSeconds must be between 1 second and 30 days' }, { status: 400 });
    }

    // Attribute visibility: prefix the comment when logging on behalf of someone.
    const commentText = loggedForName
        ? `[Logged via Zenit for ${loggedForName}]${rawComment ? ` ${rawComment}` : ''}`
        : rawComment;

    const payload: Record<string, any> = { timeSpentSeconds };
    if (commentText) {
        payload.comment = {
            type: 'doc',
            version: 1,
            content: [{ type: 'paragraph', content: [{ type: 'text', text: commentText }] }],
        };
    }
    if (started) {
        // Jira expects `yyyy-MM-dd'T'HH:mm:ss.SSSZ`; normalise ISO input.
        const d = new Date(started);
        if (!Number.isNaN(d.getTime())) {
            const pad = (n: number, l = 2) => String(n).padStart(l, '0');
            payload.started = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.000+0000`;
        }
    }

    try {
        const res = await fetch(
            `${JIRA_BASE}/rest/api/3/issue/${encodeURIComponent(issueKey)}/worklog?adjustEstimate=auto&notifyUsers=false`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Basic ${JIRA_AUTH()}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify(payload),
            }
        );

        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
            const msg = json?.errorMessages?.[0]
                || Object.values(json?.errors || {})[0]
                || 'Failed to create worklog';
            return NextResponse.json({ error: String(msg) }, { status: res.status });
        }

        // Invalidate read caches so the new entry shows up on the next fetch.
        cache.clear();

        return NextResponse.json({
            ok: true,
            worklogId: json?.id,
            issueKey,
            issueUrl: `${JIRA_BASE}/browse/${issueKey}`,
            timeSpent: json?.timeSpent,
            author: json?.author?.displayName || 'Zenit Integration',
            loggedForName: loggedForName || null,
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
