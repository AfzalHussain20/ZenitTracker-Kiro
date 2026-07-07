import { NextResponse } from 'next/server';

// GET /api/jira/fields — fetch actual Jira create issue metadata
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
    const [priorityRes, usersRes, componentsRes] = await Promise.all([
      fetch(`${JIRA_BASE}/rest/api/3/priority`, { headers, cache: 'no-store' }),
      fetch(`${JIRA_BASE}/rest/api/3/user/assignable/search?project=${PROJECT_KEY}&maxResults=100`, { headers, cache: 'no-store' }),
      fetch(`${JIRA_BASE}/rest/api/3/project/${PROJECT_KEY}/components`, { headers, cache: 'no-store' }),
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
        .filter((u: any) => u.active && u.accountType === 'atlassian')
        .map((u: any) => ({ accountId: u.accountId, displayName: u.displayName }));
    }

    // Components (teams)
    let components: { id: string; name: string }[] = [];
    if (componentsRes.ok) {
      const data = await componentsRes.json();
      components = data.map((c: any) => ({ id: c.id, name: c.name }));
    }

    // Environment field — try to fetch from create metadata
    let environments: string[] = [];
    try {
      // First get issue types to find Bug type ID
      const typesRes = await fetch(`${JIRA_BASE}/rest/api/3/issue/createmeta/${PROJECT_KEY}/issuetypes`, { headers, cache: 'no-store' });
      if (typesRes.ok) {
        const typesData = await typesRes.json();
        const bugType = (typesData.issueTypes || typesData.values || []).find((t: any) => t.name === 'Bug');
        if (bugType) {
          // Fetch fields for Bug type
          const fieldsRes = await fetch(`${JIRA_BASE}/rest/api/3/issue/createmeta/${PROJECT_KEY}/issuetypes/${bugType.id}`, { headers, cache: 'no-store' });
          if (fieldsRes.ok) {
            const fieldsData = await fieldsRes.json();
            const fields = fieldsData.fields || fieldsData.values || [];
            // Find environment field (customfield_10201)
            const envField = fields.find((f: any) => f.fieldId === 'customfield_10201' || f.key === 'customfield_10201');
            if (envField?.allowedValues) {
              environments = envField.allowedValues.map((v: any) => v.value || v.name);
            }
          }
        }
      }
    } catch { /* Environment fetch is best-effort */ }

    // If still no environments, try alternate endpoint
    if (environments.length === 0) {
      try {
        const res = await fetch(`${JIRA_BASE}/rest/api/3/field/customfield_10201/context`, { headers, cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          const contextId = data.values?.[0]?.id;
          if (contextId) {
            const optsRes = await fetch(`${JIRA_BASE}/rest/api/3/field/customfield_10201/context/${contextId}/option`, { headers, cache: 'no-store' });
            if (optsRes.ok) {
              const opts = await optsRes.json();
              environments = (opts.values || []).map((v: any) => v.value);
            }
          }
        }
      } catch { /* Best effort */ }
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
