import { NextResponse } from 'next/server';

const JIRA_BASE = process.env.JIRA_BASE_URL!;
const JIRA_AUTH = () => Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString('base64');

export async function GET(
  _req: Request,
  { params }: { params: { key: string } }
) {
  try {
    const issueKey = params.key;

    if (!issueKey || !/^[A-Z]+-\d+$/.test(issueKey)) {
      return NextResponse.json({ error: 'Invalid issue key format' }, { status: 400 });
    }

    const response = await fetch(`${JIRA_BASE}/rest/api/3/issue/${issueKey}?fields=summary,status,priority,assignee`, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${JIRA_AUTH()}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Failed to fetch issue' }, { status: response.status });
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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
