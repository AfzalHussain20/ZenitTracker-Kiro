import { NextRequest, NextResponse } from 'next/server';
import { extractPlainText, truncateForContext } from '@/lib/ai/extractText';
import { generateTestCasesForPass, extractHeadings } from '@/lib/ai/testCaseGenerator';
import { getAIProvider } from '@/lib/ai/providers';
import type { GenerateTestsRequest, GenerateTestsResponse } from '@/types/test-cases';

export const dynamic = 'force-dynamic';

/** Maps pass name to a numeric pass number for the response. */
const PASS_NUMBER_MAP: Record<string, number> = {
  functional: 1,
  negative: 2,
  exploratory: 3,
};

export async function POST(req: NextRequest) {
  try {
    const body: GenerateTestsRequest = await req.json();
    const { pageId, pass, existingTestCases = [] } = body;

    if (!pageId || !pass) {
      return NextResponse.json(
        { error: 'pageId and pass are required' },
        { status: 400 }
      );
    }

    // Validate pass value
    if (!['functional', 'negative', 'exploratory'].includes(pass)) {
      return NextResponse.json(
        { error: 'pass must be one of: functional, negative, exploratory' },
        { status: 400 }
      );
    }

    // ─── Fetch Confluence page content ────────────────────────────────────
    const baseUrl = process.env.CONFLUENCE_BASE_URL;
    const email = process.env.CONFLUENCE_EMAIL;
    const token = process.env.CONFLUENCE_API_TOKEN;

    if (!baseUrl || !email || !token) {
      return NextResponse.json(
        { error: 'Confluence not configured' },
        { status: 500 }
      );
    }

    const authHeader = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;
    const pageRes = await fetch(
      `${baseUrl}/api/v2/pages/${pageId}?body-format=storage`,
      {
        headers: { Authorization: authHeader, Accept: 'application/json' },
        cache: 'no-store',
      }
    );

    if (!pageRes.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch Confluence page' },
        { status: pageRes.status === 404 ? 404 : 502 }
      );
    }

    const pageData = await pageRes.json();
    const pageBody = pageData.body?.storage?.value || '';

    if (!pageBody) {
      return NextResponse.json(
        { error: 'No extractable content from PRD' },
        { status: 400 }
      );
    }

    // ─── Extract plain text and headings ──────────────────────────────────
    const plainText = extractPlainText(pageBody);

    if (!plainText || plainText.trim() === '') {
      return NextResponse.json(
        { error: 'No extractable content from PRD' },
        { status: 400 }
      );
    }

    const prdHeadings = extractHeadings(plainText);
    const truncatedText = truncateForContext(plainText, 16000);

    // ─── Generate test cases for the specified pass ───────────────────────
    const provider = getAIProvider();

    let testCases;
    try {
      testCases = await generateTestCasesForPass(
        truncatedText,
        prdHeadings,
        pass,
        existingTestCases,
        { maxTokens: 8192, temperature: 0.4, maxRetries: 3, contextTokenBudget: 16000 },
        provider
      );
    } catch (aiError: any) {
      const errorMessage = aiError?.message || 'AI generation failed';

      // Handle rate limit errors
      if (errorMessage.includes('429')) {
        return NextResponse.json(
          { error: 'AI provider rate limit exceeded. Please try again later.' },
          {
            status: 429,
            headers: { 'Retry-After': '30' },
          }
        );
      }

      // Handle other AI failures as 502 Bad Gateway
      console.error('[generate-tests] AI provider error:', errorMessage);
      return NextResponse.json(
        { error: 'AI generation failed. Please try again.' },
        { status: 502 }
      );
    }

    // ─── Return structured response ──────────────────────────────────────
    const response: GenerateTestsResponse = {
      testCases,
      pass: PASS_NUMBER_MAP[pass] || 1,
      totalInPass: testCases.length,
      modelUsed: provider.name,
    };

    return NextResponse.json(response);
  } catch (err: any) {
    console.error('[generate-tests] Unexpected error:', err.message);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
