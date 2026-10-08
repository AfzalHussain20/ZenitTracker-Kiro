import { NextResponse } from 'next/server';

export async function GET(
  _req: Request,
  { params }: { params: { key: string } }
) {
  const { key: issueKey } = params;
  try {

    if (!issueKey || !/^[A-Z]{2,10}-\d+$/.test(issueKey)) {
      return NextResponse.json({ error: 'Invalid issue key format. Expected: ABC-123' }, { status: 400 });
    }

    const JIRA_BASE = process.env.JIRA_BASE_URL;
    const JIRA_EMAIL = process.env.JIRA_EMAIL;
    const JIRA_TOKEN = process.env.JIRA_API_TOKEN;

    if (!JIRA_BASE || !JIRA_EMAIL || !JIRA_TOKEN) {
      return NextResponse.json({ error: 'Jira credentials not configured' }, { status: 503 });
    }

    const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_TOKEN}`).toString('base64');

    const response = await fetch(
      `${JIRA_BASE}/rest/api/3/issue/${issueKey}?fields=summary,status,priority,assignee`,
      {
        method: 'GET',
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: 'application/json',
        },
        // Don't cache — always fetch fresh
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: `Issue ${issueKey} not found` }, { status: 404 });
      }
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json({ error: 'Jira authentication failed' }, { status: 401 });
      }
      const text = await response.text().catch(() => '');
      return NextResponse.json(
        { error: `Jira responded with ${response.status}`, details: text },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      key: data.key,
      summary: data.fields?.summary || '',
      status: data.fields?.status?.name || '',
      priority: data.fields?.priority?.name || '',
      assignee: data.fields?.assignee?.displayName || null,
      link: `${JIRA_BASE}/browse/${data.key}`,
    });
  } catch (err: any) {
    console.error('[Jira] Fetch issue error:', err.message);
    return NextResponse.json({ error: `Server error: ${err.message}` }, { status: 500 });
  }
}
