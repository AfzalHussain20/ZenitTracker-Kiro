import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const baseUrl = process.env.CONFLUENCE_BASE_URL;
    const email = process.env.CONFLUENCE_EMAIL;
    const token = process.env.CONFLUENCE_API_TOKEN;

    if (!baseUrl || !email || !token) {
      return NextResponse.json({ error: 'Confluence env vars not configured', spaces: [] });
    }

    const authHeader = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(`${baseUrl}/api/v2/spaces?limit=50`, {
      headers: { Authorization: authHeader, Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Confluence API error ${res.status}`);
    }

    const data = await res.json();
    const spaces = (data.results || []).map((s: any) => ({
      id: s.id,
      key: s.key,
      name: s.name,
      type: s.type,
      icon: s.icon?.path ? `${baseUrl}${s.icon.path}` : null,
    }));

    return NextResponse.json({ spaces });
  } catch (err: any) {
    console.error('[Confluence Spaces]', err.message);
    return NextResponse.json({ error: err.message, spaces: [] }, { status: 200 });
  }
}
