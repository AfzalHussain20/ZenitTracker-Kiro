import { NextResponse } from 'next/server';

// GET /api/jira/components - fetch project components (teams)
export async function GET() {
  try {
    const JIRA_BASE = process.env.JIRA_BASE_URL;
    const JIRA_EMAIL = process.env.JIRA_EMAIL;
    const JIRA_TOKEN = process.env.JIRA_API_TOKEN;
    const PROJECT_KEY = process.env.JIRA_PROJECT_KEY || 'SUN';

    if (!JIRA_BASE || !JIRA_EMAIL || !JIRA_TOKEN) {
      return NextResponse.json({ error: 'Jira credentials not configured' }, { status: 503 });
    }

    const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_TOKEN}`).toString('base64');

    const response = await fetch(
      `${JIRA_BASE}/rest/api/3/project/${PROJECT_KEY}/components`,
      {
        headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      return NextResponse.json({ error: `Failed to fetch components: ${response.status}` }, { status: response.status });
    }

    const components = await response.json();

    return NextResponse.json({
      components: components.map((c: any) => ({
        id: c.id,
        name: c.name,
        description: c.description || '',
        lead: c.lead?.displayName || null,
      }))
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
