import { NextRequest, NextResponse } from 'next/server';

const CONFLUENCE_BASE = process.env.CONFLUENCE_BASE_URL!;
const CONFLUENCE_AUTH = () =>
  Buffer.from(`${process.env.CONFLUENCE_EMAIL}:${process.env.CONFLUENCE_API_TOKEN}`).toString('base64');

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Fetch page with body in storage format
    const pageRes = await fetch(
      `${CONFLUENCE_BASE}/api/v2/pages/${id}?body-format=storage`,
      {
        headers: {
          Authorization: `Basic ${CONFLUENCE_AUTH()}`,
          Accept: 'application/json',
        },
      }
    );

    if (!pageRes.ok) {
      const err = await pageRes.json().catch(() => ({}));
      throw new Error(err.message || `Confluence API error ${pageRes.status}`);
    }

    const pageData = await pageRes.json();

    // Fetch attachments
    let attachments: any[] = [];
    try {
      const attachRes = await fetch(
        `${CONFLUENCE_BASE}/api/v2/pages/${id}/attachments?limit=50`,
        {
          headers: {
            Authorization: `Basic ${CONFLUENCE_AUTH()}`,
            Accept: 'application/json',
          },
        }
      );

      if (attachRes.ok) {
        const attachData = await attachRes.json();
        attachments = (attachData.results || []).map((att: any) => ({
          id: att.id,
          title: att.title,
          mediaType: att.mediaType || 'application/octet-stream',
          downloadUrl: `${CONFLUENCE_BASE}/rest/api/content/${att.id}/download`,
        }));
      }
    } catch (e) {
      console.warn('[Confluence] Failed to fetch attachments:', e);
    }

    // Filter for image attachments
    const imageAttachments = attachments.filter(
      (a) => a.mediaType && a.mediaType.startsWith('image/')
    );

    const page = {
      id: pageData.id,
      title: pageData.title,
      body: pageData.body?.storage?.value || '',
      lastUpdated: pageData.version?.createdAt || null,
      space: {
        id: pageData.spaceId,
      },
      attachments: imageAttachments,
      allAttachments: attachments,
    };

    return NextResponse.json({ page });
  } catch (err: any) {
    console.error('[Confluence Page Detail]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
