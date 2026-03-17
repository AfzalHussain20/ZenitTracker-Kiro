import { NextResponse } from 'next/server';

// This is the REAL backend route for generating Jira Bugs.
// For this to work in production, you MUST add these variables to your .env.local file:
// JIRA_BASE_URL=https://your-domain.atlassian.net
// JIRA_USER_EMAIL=your.email@sunnetwork.in
// JIRA_API_TOKEN=your_jira_personal_access_token
// JIRA_PROJECT_KEY=ZEN (or your specific Jira Project Key)

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { testCaseName, testerName, steps, expected, actual, platform } = body;

        const baseUrl = process.env.JIRA_BASE_URL;
        const userEmail = process.env.JIRA_USER_EMAIL;
        const apiToken = process.env.JIRA_API_TOKEN;
        const projectKey = process.env.JIRA_PROJECT_KEY || 'QA';

        if (!baseUrl || !userEmail || !apiToken) {
            return NextResponse.json({ 
                error: 'Jira API credentials missing in .env.local',
                message: 'To push real data, setup your Jira credentials in the environment variables.'
            }, { status: 500 });
        }

        // Create the Basic Auth token required by Atlassian
        const authBuffer = Buffer.from(`${userEmail}:${apiToken}`).toString('base64');

        // Construct the strict Jira v3 REST API payload for creating an issue
        const jiraPayload = {
            fields: {
                project: {
                    key: projectKey
                },
                summary: `[Zenit Tracker] Automated Bug Submission: ${testCaseName}`,
                description: {
                    type: "doc",
                    version: 1,
                    content: [
                        {
                            type: "paragraph",
                            content: [
                                { type: "text", text: `Platform Tested: ${platform}\n\n` },
                                { type: "text", text: `Steps to Reproduce:\n${steps}\n\n` },
                                { type: "text", text: `Expected Result:\n${expected}\n\n` },
                                { type: "text", text: `Actual Result:\n${actual}\n\n`, marks: [{ type: "strong" }] },
                                { type: "text", text: `Reported By: ${testerName}` },
                            ]
                        }
                    ]
                },
                issuetype: {
                    name: "Bug" // Ensure 'Bug' issue type exists in your Jira project
                }
            }
        };

        // Make the real HTTP request to Jira
        const response = await fetch(`${baseUrl}/rest/api/3/issue`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${authBuffer}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(jiraPayload)
        });

        const jiraData = await response.json();

        if (!response.ok) {
            console.error("Jira API Error:", jiraData);
            return NextResponse.json({ error: 'Failed to create Jira issue', details: jiraData }, { status: response.status });
        }

        return NextResponse.json({ 
            success: true, 
            issueId: jiraData.id,
            issueKey: jiraData.key,
            issueLink: `${baseUrl}/browse/${jiraData.key}`
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
