import { NextRequest, NextResponse } from 'next/server';
import { quoteJql } from '@/lib/jira/jql';

const JIRA_BASE = process.env.JIRA_BASE_URL!;
const JIRA_AUTH = () => Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString('base64');
const PROJECT_KEY = process.env.JIRA_PROJECT_KEY || 'SUN';

const FIELDS = [
    'summary', 'status', 'priority', 'assignee', 'reporter',
    'created', 'updated', 'resolutiondate', 'issuetype', 'labels',
    'customfield_10103',
    'customfield_10201',
];

function mapIssue(issue: any) {
    const f = issue.fields;
    return {
        id: issue.id,
        key: issue.key,
        url: `${JIRA_BASE}/browse/${issue.key}`,
        summary: f.summary,
        issueType: f.issuetype?.name || 'Bug',
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
        platform: Array.isArray(f.customfield_10103)
            ? f.customfield_10103.map((p: any) => p.value).join(', ')
            : null,
        environment: Array.isArray(f.customfield_10201)
            ? f.customfield_10201.join(', ')
            : null,
        created: f.created,
        updated: f.updated,
        resolutionDate: f.resolutiondate || null,
    };
}

// The new /rest/api/3/search/jql uses cursor-based pagination via nextPageToken
async function fetchJiraPage(jql: string, nextPageToken?: string) {
    const encodedJql = encodeURIComponent(jql);
    const fieldsParam = FIELDS.join(',');

    let url = `${JIRA_BASE}/rest/api/3/search/jql?jql=${encodedJql}&maxResults=100&fields=${fieldsParam}`;
    if (nextPageToken) {
        url += `&nextPageToken=${encodeURIComponent(nextPageToken)}`;
    }

    const res = await fetch(url, {
        method: 'GET',
        headers: {
            Authorization: `Basic ${JIRA_AUTH()}`,
            Accept: 'application/json',
        },
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.errorMessages?.[0] || `Jira API error ${res.status}`);
    }
    return res.json();
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            jql: customJql,
            nextPageToken,   // cursor token from previous response
            issueType,
            status,
            priority,
            assigneeAccountId,
            reporterAccountId,
            search,
            createdAfter,
            createdBefore,
        } = body;

        // Free-form JQL is not accepted — values below are escaped and scoped so a
        // caller can never read issues outside this project.
        if (customJql) {
            return NextResponse.json({ error: 'Raw jql is not supported — use the structured filters' }, { status: 400 });
        }

        const clauses: string[] = [`project = ${PROJECT_KEY}`];
        if (issueType) clauses.push(`issuetype = ${quoteJql(issueType)}`);
        if (status) clauses.push(`status = ${quoteJql(status)}`);
        if (priority) clauses.push(`priority = ${quoteJql(priority)}`);
        if (assigneeAccountId) clauses.push(`assignee = ${quoteJql(assigneeAccountId)}`);
        if (reporterAccountId) clauses.push(`reporter = ${quoteJql(reporterAccountId)}`);
        if (search) clauses.push(`summary ~ ${quoteJql(search)}`);

        const jiraDate = (value: unknown): string | null => {
            const d = new Date(value as string);
            if (Number.isNaN(d.getTime())) return null;
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        };
        const createdAfterDate = createdAfter ? jiraDate(createdAfter) : null;
        if (createdAfterDate) clauses.push(`created >= ${quoteJql(createdAfterDate)}`);
        const createdBeforeDate = createdBefore ? jiraDate(createdBefore) : null;
        if (createdBeforeDate) clauses.push(`created <= ${quoteJql(createdBeforeDate)}`);

        const jql = clauses.join(' AND ') + ' ORDER BY created DESC';

        const data = await fetchJiraPage(jql, nextPageToken);
        const issues = data.issues || [];

        console.log(`[Jira API] returned=${issues.length} | isLast=${data.isLast} | hasToken=${!!data.nextPageToken}`);

        return NextResponse.json({
            issues: issues.map(mapIssue),
            nextPageToken: data.nextPageToken || null,
            isLast: data.isLast === true,
            // Keep these for compatibility
            total: null,
            hasMore: !data.isLast,
        });
    } catch (err: any) {
        console.error('API Route Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
