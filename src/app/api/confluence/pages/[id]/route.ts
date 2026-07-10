import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const baseUrl = process.env.CONFLUENCE_BASE_URL;
    const email = process.env.CONFLUENCE_EMAIL;
    const token = process.env.CONFLUENCE_API_TOKEN;

    if (!baseUrl || !email || !token) {
      return NextResponse.json({ error: 'Confluence env vars not configured' }, { status: 500 });
    }

    const authHeader = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    // Fetch page with body in storage format
    const pageRes = await fetch(
      `${baseUrl}/api/v2/pages/${id}?body-format=storage`,
      { headers: { Authorization: authHeader, Accept: 'application/json' }, cache: 'no-store', signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!pageRes.ok) {
      const err = await pageRes.json().catch(() => ({}));
      throw new Error(err.message || `Confluence API error ${pageRes.status}`);
    }

    const pageData = await pageRes.json();

    // Fetch attachments
    let attachments: any[] = [];
    try {
      const attachRes = await fetch(
        `${baseUrl}/api/v2/pages/${id}/attachments?limit=50`,
        { headers: { Authorization: authHeader, Accept: 'application/json' }, cache: 'no-store' }
      );
      if (attachRes.ok) {
        const attachData = await attachRes.json();
        attachments = (attachData.results || []).map((att: any) => ({
          id: att.id,
          title: att.title,
          mediaType: att.mediaType || 'application/octet-stream',
          downloadUrl: `${baseUrl}/rest/api/content/${att.id}/download`,
        }));
      }
    } catch (e) {
      console.warn('[Confluence] Failed to fetch attachments:', e);
    }

    // Fetch comments (footer comments on the page)
    let comments: any[] = [];
    try {
      // Use v1 endpoint which includes full author info with expand
      const commentsRes = await fetch(
        `${baseUrl}/rest/api/content/${id}/child/comment?limit=25&expand=body.storage,version,extensions.inlineProperties&orderby=-created`,
        { headers: { Authorization: authHeader, Accept: 'application/json' }, cache: 'no-store' }
      );
      if (commentsRes.ok) {
        const commentsData = await commentsRes.json();
        comments = (commentsData.results || []).map((c: any) => ({
          id: c.id,
          body: (c.body?.storage?.value || c.body?.view?.value || '')
            .replace(/<ac:[^>]*>[\s\S]*?<\/ac:[^>]*>/gi, '')
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .trim(),
          createdAt: c.version?.when || c.history?.createdDate || null,
          author: c.version?.by?.displayName || c.version?.by?.publicName || c.history?.createdBy?.displayName || 'Unknown',
        }));
      }
    } catch (e) {
      console.warn('[Confluence] Failed to fetch comments:', e);
    }

    const imageAttachments = attachments.filter(
      (a) => a.mediaType && a.mediaType.startsWith('image/')
    );

    const page = {
      id: pageData.id,
      title: pageData.title,
      body: pageData.body?.storage?.value || '',
      lastUpdated: pageData.version?.createdAt || null,
      space: { id: pageData.spaceId },
      attachments: imageAttachments,
      allAttachments: attachments,
      comments,
    };

    return NextResponse.json({ page });
  } catch (err: any) {
    console.error('[Confluence Page Detail]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
