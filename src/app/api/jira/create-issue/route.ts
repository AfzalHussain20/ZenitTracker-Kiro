import { NextResponse } from 'next/server';

const JIRA_BASE = process.env.JIRA_BASE_URL!;
const JIRA_AUTH = () => Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString('base64');
const PROJECT_KEY = process.env.JIRA_PROJECT_KEY || 'SUN';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const {
            title, description, stepsToReproduce, expectedResult, actualResult,
            severity, priority, platform, appVersion, environment,
            existingInLive, frequency, labels, assigneeAccountId, reportedByName,
            // Legacy session page fields
            testCaseName, testerName, steps, expected, actual,
        } = body;

        const summary = title || `[Zenit] ${testCaseName}`;
        const stepsText = stepsToReproduce || steps || '';
        const expectedText = expectedResult || expected || '';
        const actualText = actualResult || actual || '';
        const reporter = reportedByName || testerName || 'Zenit Tracker';

        // Map severity → Jira priority name
        const priorityMap: Record<string, string> = {
            Critical: 'Highest', High: 'High', Medium: 'Medium', Low: 'Low',
            P1: 'Highest', P2: 'High', P3: 'Medium', P4: 'Low',
        };
        const jiraPriority = priorityMap[severity] || priorityMap[priority] || 'Medium';

        // Build description in Atlassian Document Format
        const makeSection = (heading: string, text: string) => ([
            { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: heading }] },
            { type: 'paragraph', content: [{ type: 'text', text: text || 'N/A' }] },
        ]);

        const descContent = [
            ...makeSection('Summary', description || summary),
            ...(stepsText ? makeSection('Steps to Reproduce', stepsText) : []),
            ...(expectedText ? makeSection('Expected Result', expectedText) : []),
            ...(actualText ? makeSection('Actual Result', actualText) : []),
            ...makeSection('Environment Info', `Platform: ${platform || 'N/A'} | Version: ${appVersion || 'N/A'} | Reported by: ${reporter}`),
            { type: 'paragraph', content: [{ type: 'text', text: '🔗 Logged via Zenit Tracker', marks: [{ type: 'em' }] }] },
        ];

        const fields: Record<string, any> = {
            project: { key: PROJECT_KEY },
            summary,
            description: { type: 'doc', version: 1, content: descContent },
            issuetype: { name: 'Bug' },
            priority: { name: jiraPriority },
            // Required custom field: Environment
            customfield_10201: environment ? [environment] : ['Staging'],
            // Optional custom fields
            ...(actualText ? { customfield_10236: actualText } : {}),
            ...(appVersion ? { customfield_10268: [appVersion] } : {}),
            ...(existingInLive ? { customfield_10237: [existingInLive] } : {}),
            ...(frequency ? { customfield_10202: frequency } : {}),
            ...(labels?.length ? { labels } : {}),
            ...(assigneeAccountId ? { assignee: { accountId: assigneeAccountId } } : {}),
        };

        const response = await fetch(`${JIRA_BASE}/rest/api/3/issue`, {
            method: 'POST',
            headers: {
                Authorization: `Basic ${JIRA_AUTH()}`,
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ fields }),
        });

        const data = await response.json();

        if (!response.ok) {
            const msg = data.errorMessages?.[0] || Object.entries(data.errors || {}).map(([k, v]) => `${k}: ${v}`).join(', ') || 'Failed to create issue';
            console.error('[Jira] Create failed:', JSON.stringify(data));
            return NextResponse.json({ error: msg, details: data }, { status: response.status });
        }

        return NextResponse.json({
            success: true,
            issueId: data.id,
            issueKey: data.key,
            issueLink: `${JIRA_BASE}/browse/${data.key}`,
        });
    } catch (err: any) {
        console.error('[Jira] Error:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
