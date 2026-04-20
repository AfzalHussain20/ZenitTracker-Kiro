import { NextRequest, NextResponse } from 'next/server';

const getJiraAuth = () => {
    const baseUrl = process.env.JIRA_BASE_URL;
    const email = process.env.JIRA_EMAIL;
    const token = process.env.JIRA_API_TOKEN;
    const projectKey = process.env.JIRA_PROJECT_KEY || 'SUN';
    if (!baseUrl || !email || !token) throw new Error('Jira credentials not configured');
    const auth = Buffer.from(`${email}:${token}`).toString('base64');
    return { baseUrl, auth, projectKey };
};

// GET /api/jira/projects - fetch project metadata including issue types, priorities, components
export async function GET(req: NextRequest) {
    try {
        const { baseUrl, auth, projectKey } = getJiraAuth();

        // Fetch project details
        const [projectRes, prioritiesRes, issueTypesRes] = await Promise.all([
            fetch(`${baseUrl}/rest/api/3/project/${projectKey}`, {
                headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' }
            }),
            fetch(`${baseUrl}/rest/api/3/priority`, {
                headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' }
            }),
            fetch(`${baseUrl}/rest/api/3/issuetype`, {
                headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' }
            }),
        ]);

        const project = projectRes.ok ? await projectRes.json() : null;
        const priorities = prioritiesRes.ok ? await prioritiesRes.json() : [];
        const issueTypes = issueTypesRes.ok ? await issueTypesRes.json() : [];

        return NextResponse.json({
            project: project ? {
                key: project.key,
                name: project.name,
                id: project.id,
                components: project.components?.map((c: any) => ({ id: c.id, name: c.name })) || [],
            } : null,
            priorities: priorities.map((p: any) => ({ id: p.id, name: p.name })),
            issueTypes: issueTypes
                .filter((t: any) => !t.subtask)
                .map((t: any) => ({ id: t.id, name: t.name })),
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
