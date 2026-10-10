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
            existingInLive, frequency, labels, assigneeAccountId, componentId, reportedByName,
            // Legacy session page fields
            testCaseName, testerName, steps, expected, actual,
        } = body;

        const summary = title || `[Zenit] ${testCaseName}`;
        const stepsText = stepsToReproduce || steps || '';
        const expectedText = expectedResult || expected || '';
        const actualText = actualResult || actual || '';
        const reporter = reportedByName || testerName || 'Zenit Tracker';

        // Map severity/priority (test-case level, Jira priority name, or keyword) → a valid Jira priority name
        const priorityMap: Record<string, string> = {
            // test-case / QA keywords
            critical: 'Highest', blocker: 'Highest', major: 'High', normal: 'Medium', minor: 'Low', trivial: 'Lowest',
            // P-levels (P0/P1 highest … P5 lowest)
            p0: 'Highest', p1: 'Highest', p2: 'High', p3: 'Medium', p4: 'Low', p5: 'Lowest',
            // Jira priority names sent verbatim by the severity dropdown
            highest: 'Highest', high: 'High', medium: 'Medium', low: 'Low', lowest: 'Lowest',
        };
        const resolvePriority = (value: unknown): string | undefined => {
            if (typeof value !== 'string') return undefined;
            const key = value.trim().toLowerCase();
            return priorityMap[key];
        };
        const jiraPriority = resolvePriority(severity) || resolvePriority(priority) || 'Medium';

        // Build description in Atlassian Document Format — Professional QA Template
        const makeHeading = (text: string) => ({ type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text }] });
        const makeParagraph = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text: text || 'N/A' }] });
        const makeBold = (label: string, value: string) => ({
          type: 'paragraph', content: [
            { type: 'text', text: `${label}: `, marks: [{ type: 'strong' }] },
            { type: 'text', text: value || 'N/A' },
          ]
        });
        const makeRule = () => ({ type: 'rule' });

        const descContent = [
          makeHeading('🐛 Bug Description'),
          makeParagraph(description || summary),
          makeRule(),
          makeHeading('📋 Steps to Reproduce'),
          ...(stepsText ? stepsText.split('\n').filter(Boolean).map((s: string, i: number) =>
            makeParagraph(`${i + 1}. ${s.replace(/^\d+[\.\)]\s*/, '')}`)
          ) : [makeParagraph('N/A')]),
          makeRule(),
          makeHeading('✅ Expected Result'),
          makeParagraph(expectedText),
          makeHeading('❌ Actual Result'),
          makeParagraph(actualText),
          makeRule(),
          makeHeading('🔧 Environment'),
          makeBold('Platform', platform || 'N/A'),
          makeBold('App Version', appVersion || 'N/A'),
          makeBold('Environment', environment || 'Staging'),
          makeBold('Reported by', reporter),
          makeBold('Tool', 'Zenit Tracker — Automated QA Session'),
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
            // Only send componentId if it looks like a valid Jira component ID (numeric)
            // Team IDs from Atlassian Teams API are UUIDs and are NOT valid component IDs
            ...(componentId && /^\d+$/.test(componentId) ? { components: [{ id: componentId }] } : {}),
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
