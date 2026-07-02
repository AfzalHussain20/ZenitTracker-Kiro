import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const spaceId = searchParams.get('spaceId');
    const query = searchParams.get('q');

    const baseUrl = process.env.CONFLUENCE_BASE_URL;
    const email = process.env.CONFLUENCE_EMAIL;
    const token = process.env.CONFLUENCE_API_TOKEN;

    if (!baseUrl || !email || !token) {
      return NextResponse.json({ error: 'Confluence env vars not configured', pages: [] }, { status: 200 });
    }

    const authHeader = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;

    let url: string;

    if (query) {
      const cql = encodeURIComponent(`type=page AND title~"${query}"`);
      url = `${baseUrl}/rest/api/content/search?cql=${cql}&limit=30&expand=space,version,body.export_view`;
    } else if (spaceId) {
      url = `${baseUrl}/api/v2/pages?space-id=${spaceId}&limit=30&sort=-modified-date`;
    } else {
      url = `${baseUrl}/api/v2/pages?limit=30&sort=-modified-date`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
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

    let pages: any[];

    if (query) {
      // CQL search returns v1-style results
      pages = (data.results || []).map((p: any) => ({
        id: p.id,
        title: p.title,
        spaceId: p.space?.id || null,
        spaceName: p.space?.name || null,
        spaceKey: p.space?.key || null,
        lastUpdated: p.version?.when || null,
        excerpt: p.body?.export_view?.value
          ? stripHtml(p.body.export_view.value).substring(0, 200)
          : (p.excerpt || ''),
      }));
    } else {
      // v2 API results
      pages = (data.results || []).map((p: any) => ({
        id: p.id,
        title: p.title,
        spaceId: p.spaceId || null,
        spaceName: null, // v2 doesn't include space name inline
        spaceKey: null,
        lastUpdated: p.version?.createdAt || null,
        excerpt: '',
      }));
    }

    return NextResponse.json({ pages });
  } catch (err: any) {
    console.error('[Confluence Pages]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<ac:structured-macro[^>]*>[\s\S]*?<\/ac:structured-macro>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}
