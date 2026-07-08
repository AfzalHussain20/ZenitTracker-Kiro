import { NextResponse } from 'next/server';

// GET /api/jira/fields — fetch actual Jira field values by querying existing issues
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
    const headers = { Authorization: `Basic ${auth}`, Accept: 'application/json' };

    // Fetch all data in parallel
    const [priorityRes, usersRes, componentsRes, issuesRes] = await Promise.all([
      fetch(`${JIRA_BASE}/rest/api/3/priority`, { headers, cache: 'no-store' }),
      fetch(`${JIRA_BASE}/rest/api/3/user/assignable/search?project=${PROJECT_KEY}&maxResults=100`, { headers, cache: 'no-store' }),
      fetch(`${JIRA_BASE}/rest/api/3/project/${PROJECT_KEY}/components`, { headers, cache: 'no-store' }),
      // Fetch recent issues to extract actual environment values used
      fetch(`${JIRA_BASE}/rest/api/3/search?jql=${encodeURIComponent(`project=${PROJECT_KEY} ORDER BY created DESC`)}&maxResults=50&fields=customfield_10201`, { headers, cache: 'no-store' }),
    ]);

    // Priorities
    let priorities: { id: string; name: string }[] = [];
    if (priorityRes.ok) {
      const data = await priorityRes.json();
      priorities = data.map((p: any) => ({ id: p.id, name: p.name }));
    }

    // Assignable users
    let users: { accountId: string; displayName: string }[] = [];
    if (usersRes.ok) {
      const data = await usersRes.json();
      users = data
        .filter((u: any) => u.active !== false)
        .map((u: any) => ({ accountId: u.accountId, displayName: u.displayName }))
        .sort((a: any, b: any) => a.displayName.localeCompare(b.displayName));
    }

    // Components (teams)
    let components: { id: string; name: string }[] = [];
    if (componentsRes.ok) {
      const data = await componentsRes.json();
      components = data.map((c: any) => ({ id: c.id, name: c.name }));
    }

    // Extract environments from existing issues (most reliable method)
    let environments: string[] = [];
    if (issuesRes.ok) {
      const issuesData = await issuesRes.json();
      const envSet = new Set<string>();
      (issuesData.issues || []).forEach((issue: any) => {
        const envField = issue.fields?.customfield_10201;
        if (Array.isArray(envField)) {
          envField.forEach((v: string) => { if (v) envSet.add(v); });
        }
      });
      environments = Array.from(envSet).sort();
    }

    // Fallback environments if none found from issues
    if (environments.length === 0) {
      environments = ['Dev', 'QA', 'Staging', 'Pre-Prod', 'UAT', 'Production'];
    }

    return NextResponse.json({
      environments,
      priorities,
      users,
      components,
      projectKey: PROJECT_KEY,
    });
  } catch (err: any) {
    console.error('[Jira Fields]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
