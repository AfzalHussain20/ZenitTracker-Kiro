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

// GET /api/jira/users - fetch all assignable users for the project
export async function GET(req: NextRequest) {
    try {
        const { baseUrl, auth, projectKey } = getJiraAuth();

        // Fetch assignable users for the project
        const res = await fetch(
            `${baseUrl}/rest/api/3/user/assignable/search?project=${projectKey}&maxResults=50`,
            { headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' } }
        );

        if (!res.ok) {
            const err = await res.json();
            return NextResponse.json({ error: err.errorMessages?.[0] || 'Failed to fetch users' }, { status: res.status });
        }

        const users = await res.json();
        return NextResponse.json({
            users: users.map((u: any) => ({
                accountId: u.accountId,
                displayName: u.displayName,
                email: u.emailAddress,
                avatarUrl: u.avatarUrls?.['48x48'],
                active: u.active,
            }))
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
