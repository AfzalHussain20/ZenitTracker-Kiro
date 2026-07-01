import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CONFLUENCE_BASE = process.env.CONFLUENCE_BASE_URL!;
const CONFLUENCE_AUTH = () =>
  Buffer.from(`${process.env.CONFLUENCE_EMAIL}:${process.env.CONFLUENCE_API_TOKEN}`).toString('base64');

export async function GET() {
  try {
    const res = await fetch(`${CONFLUENCE_BASE}/api/v2/spaces?limit=50`, {
      headers: {
        Authorization: `Basic ${CONFLUENCE_AUTH()}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

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
      icon: s.icon?.path ? `${CONFLUENCE_BASE}${s.icon.path}` : null,
    }));

    return NextResponse.json({ spaces });
  } catch (err: any) {
    console.error('[Confluence Spaces]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
