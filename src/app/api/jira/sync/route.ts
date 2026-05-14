/**
 * Jira Sync API — Server-side cache with background refresh
 * - Fetches ALL issue types in true parallel (no sequential delays)
 * - Caches 10 minutes server-side
 * - Returns stale data immediately while refreshing in background
 * - Includes story points, assigned tickets, live build status
 */

import { NextRequest, NextResponse } from 'next/server';

const JIRA_BASE = process.env.JIRA_BASE_URL!;
const JIRA_AUTH = () => Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString('base64');
const PROJECT_KEY = process.env.JIRA_PROJECT_KEY || 'SUN';
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Story points field — Jira uses customfield_10016 (most common) or customfield_10028
const STORY_POINTS_FIELD = 'customfield_10016';

const FIELDS = [
    'summary', 'status', 'priority', 'assignee', 'reporter',
    'created', 'updated', 'resolutiondate', 'issuetype', 'labels',
    'customfield_10103', 'customfield_10201',
    'timespent', 'timeoriginalestimate',
    STORY_POINTS_FIELD,  // story points
    'customfield_10028', // story points alt field
    'fixVersions',       // for live build tracking
    'versions',
    'customfield_10001', // Team field
    'customfield_10020', // Sprint field
];

interface CacheEntry { data: any; ts: number; fetching: boolean; }
const cache = new Map<string, CacheEntry>();

function mapIssue(issue: any) {
    const f = issue.fields;
    // Story points — try both common fields
    const storyPoints = f[STORY_POINTS_FIELD] ?? f['customfield_10028'] ?? null;
    // Live build = has a fixVersion with "released: true" or name contains "Live"
    const fixVersions: any[] = f.fixVersions || [];
    const isLive = fixVersions.some((v: any) => v.released === true || /live|prod|release/i.test(v.name || ''));
    const liveVersion = fixVersions.find((v: any) => v.released || /live|prod/i.test(v.name || ''))?.name || null;
    // Team field (customfield_10001) — Jira returns { id, name, title } or just a string
    const teamField = f['customfield_10001'];
    let team: string | null = null;
    if (teamField) {
        if (typeof teamField === 'string') team = teamField;
        else if (typeof teamField === 'object') {
            team = teamField.name || teamField.title || teamField.displayName || teamField.value || null;
        }
    }

    return {
        id: issue.id,
        key: issue.key,
        url: `${JIRA_BASE}/browse/${issue.key}`,
        summary: f.summary,
        issueType: f.issuetype?.name || 'Unknown',
        status: f.status?.name || 'Unknown',
        statusCategory: f.status?.statusCategory?.name || 'Unknown',
        priority: f.priority?.name || 'Medium',
        assignee: f.assignee ? {
            accountId: f.assignee.accountId,
            displayName: f.assignee.displayName,
            avatarUrl: f.assignee.avatarUrls?.['48x48'],
        } : null,
        reporter: f.reporter ? {
            accountId: f.reporter.accountId,
            displayName: f.reporter.displayName,
            avatarUrl: f.reporter.avatarUrls?.['48x48'],
        } : null,
        labels: f.labels || [],
        platform: Array.isArray(f.customfield_10103) ? f.customfield_10103.map((p: any) => p.value).join(', ') : null,
        environment: Array.isArray(f.customfield_10201) ? f.customfield_10201.join(', ') : null,
        created: f.created,
        updated: f.updated,
        resolutionDate: f.resolutiondate || null,
        timeSpent: f.timespent || 0,
        timeEstimate: f.timeoriginalestimate || 0,
        storyPoints: typeof storyPoints === 'number' ? storyPoints : null,
        isLive,
        liveVersion,
        fixVersions: fixVersions.map((v: any) => ({ name: v.name, released: v.released })),
        team,  // Team name from customfield_10001
        sprint: (() => {
            // customfield_10020 can be an array of sprint objects or a single object
            const sf = f['customfield_10020'];
            if (!sf) return null;
            const sprints: any[] = Array.isArray(sf) ? sf : [sf];
            // Find the active sprint first, then the most recent
            const active = sprints.find((s: any) => s.state === 'active');
            const latest = active || sprints[sprints.length - 1];
            if (!latest) return null;
            return {
                id: latest.id,
                name: latest.name,
                state: latest.state, // 'active' | 'closed' | 'future'
                startDate: latest.startDate || null,
                endDate: latest.endDate || null,
            };
        })(),
    };
}

// Fetch all pages for a given JQL using cursor pagination — no artificial delays
async function fetchAllPages(jql: string): Promise<any[]> {
    const all: any[] = [];
    let nextPageToken: string | null = null;
    const encodedJql = encodeURIComponent(jql);
    const fieldsParam = FIELDS.join(',');

    while (true) {
        let url = `${JIRA_BASE}/rest/api/3/search/jql?jql=${encodedJql}&maxResults=100&fields=${fieldsParam}`;
        if (nextPageToken) url += `&nextPageToken=${encodeURIComponent(nextPageToken)}`;

        const res = await fetch(url, {
            headers: { Authorization: `Basic ${JIRA_AUTH()}`, Accept: 'application/json' },
            // No cache on server-side fetch
            cache: 'no-store',
        });

        if (!res.ok) {
            console.error(`[Sync] HTTP ${res.status} for JQL: ${jql.slice(0, 60)}`);
            break;
        }

        const data = await res.json();
        const batch = data.issues || [];
        all.push(...batch.map(mapIssue));

        if (data.isLast || !data.nextPageToken) break;
        nextPageToken = data.nextPageToken;
        // No delay — let Jira rate limit naturally
    }

    return all;
}

async function buildFullSync() {
    const start = Date.now();
    console.log('[Sync] Starting parallel Jira sync...');

    // Fetch all types truly in parallel — no sequential waiting
    const [bugs, stories, epics, tasks, subtasks] = await Promise.all([
        fetchAllPages(`project = ${PROJECT_KEY} AND issuetype = "Bug" ORDER BY created DESC`),
        fetchAllPages(`project = ${PROJECT_KEY} AND issuetype = "Story" ORDER BY created DESC`),
        fetchAllPages(`project = ${PROJECT_KEY} AND issuetype = "Epic" ORDER BY created DESC`),
        fetchAllPages(`project = ${PROJECT_KEY} AND issuetype = "Task" ORDER BY created DESC`),
        fetchAllPages(`project = ${PROJECT_KEY} AND issuetype = "Sub-task" ORDER BY created DESC`),
    ]);

    const all = [...bugs, ...stories, ...epics, ...tasks, ...subtasks];
    const elapsed = Date.now() - start;

    // Live build tickets = any issue with a released fix version
    const liveTickets = all.filter(i => i.isLive);

    console.log(`[Sync] Done in ${elapsed}ms: ${all.length} total (bugs=${bugs.length}, stories=${stories.length}, epics=${epics.length}, tasks=${tasks.length}, subtasks=${subtasks.length}, live=${liveTickets.length})`);

    return {
        all, bugs, stories, epics, tasks, subtasks,
        liveTickets,
        syncedAt: new Date().toISOString(),
        syncDurationMs: elapsed,
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
export async function GET(_req: NextRequest) {
    const key = 'full_sync';
    const entry = cache.get(key);
    const now = Date.now();
    const isStale = !entry || (now - entry.ts) >= CACHE_TTL;

    // If we have data (even stale), return it immediately
    if (entry?.data) {
        // Trigger background refresh if stale and not already fetching
        if (isStale && !entry.fetching) {
            cache.set(key, { ...entry, fetching: true });
            buildFullSync().then(data => {
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
        const data = await buildFullSync();
        cache.set(key, { data, ts: now, fetching: false });
        return NextResponse.json({ ...data, cacheAge: 0, nextRefresh: CACHE_TTL / 1000, fromCache: false });
    } catch (err: any) {
        cache.set(key, { data: null, ts: 0, fetching: false });
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// POST: force immediate refresh
export async function POST() {
    const key = 'full_sync';
    try {
        cache.set(key, { data: cache.get(key)?.data || null, ts: 0, fetching: true });
        const data = await buildFullSync();
        cache.set(key, { data, ts: Date.now(), fetching: false });
        return NextResponse.json({ ...data, fromCache: false, forced: true });
    } catch (err: any) {
        cache.set(key, { data: cache.get(key)?.data || null, ts: 0, fetching: false });
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
