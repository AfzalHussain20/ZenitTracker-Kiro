import { NextResponse } from 'next/server';

// GET /api/jira/fields — fetch actual Jira create issue metadata (environments, priorities, etc.)
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

    // Fetch create issue metadata for Bug issue type
    const metaRes = await fetch(
      `${JIRA_BASE}/rest/api/3/issue/createmeta/${PROJECT_KEY}/issuetypes`,
      { headers, cache: 'no-store' }
    );

    let issueTypeId = '';
    if (metaRes.ok) {
      const metaData = await metaRes.json();
      const bugType = metaData.issueTypes?.find((t: any) => t.name === 'Bug') || metaData.values?.find((t: any) => t.name === 'Bug');
      if (bugType) issueTypeId = bugType.id;
    }

    // Fetch field options for the Bug issue type
    let environments: string[] = [];
    let priorities: { id: string; name: string }[] = [];

    // Fetch priorities (standard Jira endpoint)
    const priorityRes = await fetch(`${JIRA_BASE}/rest/api/3/priority`, { headers, cache: 'no-store' });
    if (priorityRes.ok) {
      const priorityData = await priorityRes.json();
      priorities = priorityData.map((p: any) => ({ id: p.id, name: p.name }));
    }

    // Fetch environment field options (customfield_10201)
    // Try the field configuration context endpoint
    if (issueTypeId) {
      const fieldsRes = await fetch(
        `${JIRA_BASE}/rest/api/3/issue/createmeta/${PROJECT_KEY}/issuetypes/${issueTypeId}`,
        { headers, cache: 'no-store' }
      );
      if (fieldsRes.ok) {
        const fieldsData = await fieldsRes.json();
        // Look for environment field (customfield_10201)
        const envField = fieldsData.fields?.find((f: any) => f.fieldId === 'customfield_10201') 
          || fieldsData.values?.find((f: any) => f.fieldId === 'customfield_10201');
        if (envField?.allowedValues) {
          environments = envField.allowedValues.map((v: any) => v.value || v.name || v);
        }
      }
    }

    // Fallback: if no environments found from metadata, try fetching the field options directly
    if (environments.length === 0) {
      const optionsRes = await fetch(
        `${JIRA_BASE}/rest/api/3/field/customfield_10201/context`,
        { headers, cache: 'no-store' }
      );
      if (optionsRes.ok) {
        const optData = await optionsRes.json();
        if (optData.values?.[0]?.id) {
          const contextId = optData.values[0].id;
          const optsRes = await fetch(
            `${JIRA_BASE}/rest/api/3/field/customfield_10201/context/${contextId}/option`,
            { headers, cache: 'no-store' }
          );
          if (optsRes.ok) {
            const opts = await optsRes.json();
            environments = (opts.values || []).map((v: any) => v.value);
          }
        }
      }
    }

    // Final fallback — known SUN NXT environments
    if (environments.length === 0) {
      environments = ['Dev', 'QA', 'Staging', 'Preprod', 'UAT', 'Production'];
    }

    return NextResponse.json({
      environments,
      priorities,
      issueTypeId,
      projectKey: PROJECT_KEY,
    });
  } catch (err: any) {
    console.error('[Jira Fields]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
