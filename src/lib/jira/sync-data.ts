/**
 * Shared Jira sync primitives — issue mapping + cursor pagination.
 * Used by the live sync route and the all-time cache builder so both produce
 * the exact same JiraIssueRaw shape.
 */

export const PROJECT_KEY = process.env.JIRA_PROJECT_KEY || 'SUN';
export const JIRA_BASE = process.env.JIRA_BASE_URL!;
export const JIRA_AUTH = () => Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString('base64');

// Story points field — Jira uses customfield_10016 (most common) or customfield_10028
export const STORY_POINTS_FIELD = 'customfield_10016';

// Full field list for live (sprint-scoped) sync
export const FIELDS = [
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

// Slimmer list for the all-time cache — every mapped field the KPI/analytics
// UI consumes, minus bulky per-issue extras (sprint array, platform/environment).
export const ALLTIME_FIELDS = [
    'summary', 'status', 'priority', 'assignee', 'reporter',
    'created', 'updated', 'resolutiondate', 'issuetype', 'labels',
    STORY_POINTS_FIELD,
    'customfield_10028',
    'fixVersions',
    'customfield_10001',
];

export function mapIssue(issue: any) {
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
        team,
        isSubTask: f.issuetype?.subtask === true || f.issuetype?.name === 'Sub-task',
        sprint: (() => {
            // customfield_10020 can be an array of sprint objects or a single object
            const sf = f['customfield_10020'];
            if (!sf) return null;
            const sprints: any[] = Array.isArray(sf) ? sf : [sf];
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

// Fetch all pages for a JQL using cursor pagination.
// Note: /search/jql caps each page at 100 when requesting real fields (only a
// `key`-only or empty field list returns 500/page), so subrequest budgets must
// account for ~100 issues per page.
export async function fetchAllPages(jql: string, fields: string = FIELDS.join(',')): Promise<any[]> {
    const all: any[] = [];
    let nextPageToken: string | null = null;
    const encodedJql = encodeURIComponent(jql);
    const fieldsParam = fields;
    let attempt = 0;

    while (true) {
        let url = `${JIRA_BASE}/rest/api/3/search/jql?jql=${encodedJql}&maxResults=100&fields=${encodeURIComponent(fieldsParam)}`;
        if (nextPageToken) url += `&nextPageToken=${encodeURIComponent(nextPageToken)}`;

        const res = await fetch(url, {
            headers: { Authorization: `Basic ${JIRA_AUTH()}`, Accept: 'application/json' },
            cache: 'no-store',
        });

        if (!res.ok) {
            if ((res.status === 429 || res.status >= 500) && attempt < 2) {
                attempt++;
                await new Promise(r => setTimeout(r, 500 * attempt));
                continue;
            }
            throw new Error(`[Jira] HTTP ${res.status} for JQL: ${jql.slice(0, 60)}`);
        }
        attempt = 0;

        const data = await res.json();
        const batch = data.issues || [];
        all.push(...batch.map(mapIssue));

        if (data.isLast || !data.nextPageToken) break;
        nextPageToken = data.nextPageToken;
    }

    return all;
}