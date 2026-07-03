import { NextRequest, NextResponse } from 'next/server';
import { extractPlainText, truncateForContext } from '@/lib/ai/extractText';
import { generateTestCasesForPass, extractHeadings } from '@/lib/ai/testCaseGenerator';
import { getAIProvider } from '@/lib/ai/providers';
import type { GenerateTestsRequest, GenerateTestsResponse, GenerationPass } from '@/types/test-cases';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel Pro: 60s, Hobby: 10s — set high for Pro users

/** Maps pass name to a numeric pass number for the response. */
const PASS_NUMBER_MAP: Record<string, number> = {
  functional: 1,
  negative: 2,
  exploratory: 3,
  web: 1,
  tv: 2,
  mobile: 3,
  functional_sanity: 1,
  negative_edge: 2,
  exploratory_more: 3,
};

/**
 * Calculates the next Gemini quota reset time.
 * Gemini free tier resets at midnight Pacific Time (PT).
 * Returns ISO string in UTC and a human-readable IST string.
 */
function getNextResetTime(): { iso: string; readableIST: string } {
  const now = new Date();

  // PDT is active roughly March second Sunday to November first Sunday
  const month = now.getUTCMonth(); // 0-indexed
  const isPDT = month >= 2 && month <= 10; // March through October (approximation)
  
  const resetHourUTC = isPDT ? 7 : 8; // midnight PT in UTC

  // Find next reset
  const nextReset = new Date(now);
  nextReset.setUTCHours(resetHourUTC, 0, 0, 0);
  
  if (now >= nextReset) {
    // Already past today's reset, next one is tomorrow
    nextReset.setUTCDate(nextReset.getUTCDate() + 1);
  }

  // Format for IST (UTC+5:30)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(nextReset.getTime() + istOffset);
  const hours = istDate.getUTCHours();
  const minutes = istDate.getUTCMinutes();
  const day = istDate.getUTCDate();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = monthNames[istDate.getUTCMonth()];
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 || 12;
  const readableIST = `${day} ${monthName}, ${h12}:${minutes.toString().padStart(2, '0')} ${ampm} IST`;

  return { iso: nextReset.toISOString(), readableIST };
}

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

    // Validate pass value — support both original and platform-based passes
    const validPasses = ['functional', 'negative', 'exploratory', 'web', 'tv', 'mobile', 'all', 'functional_sanity', 'negative_edge', 'exploratory_more'];
    if (!validPasses.includes(pass)) {
      return NextResponse.json(
        { error: `pass must be one of: ${validPasses.join(', ')}` },
        { status: 400 }
      );
    }

    // ─── Fetch Confluence page content ────────────────────────────────────
    const baseUrl = process.env.CONFLUENCE_BASE_URL;
    const email = process.env.CONFLUENCE_EMAIL;
    const token = process.env.CONFLUENCE_API_TOKEN;

    if (!baseUrl || !email || !token) {
      return NextResponse.json(
        { error: 'Confluence not configured. Check CONFLUENCE_BASE_URL, CONFLUENCE_EMAIL, CONFLUENCE_API_TOKEN env vars.' },
        { status: 500 }
      );
    }

    // Ensure base URL doesn't have trailing slash
    const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
    const authHeader = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;

    let pageRes;
    try {
      pageRes = await fetch(
        `${cleanBaseUrl}/api/v2/pages/${pageId}?body-format=storage`,
        {
          headers: { Authorization: authHeader, Accept: 'application/json' },
          cache: 'no-store',
          signal: AbortSignal.timeout(8000), // 8s timeout for Confluence fetch
        }
      );
    } catch (fetchErr: any) {
      console.error('[generate-tests] Confluence fetch error:', fetchErr.message);
      return NextResponse.json(
        { error: `Failed to reach Confluence: ${fetchErr.message}` },
        { status: 502 }
      );
    }

    if (!pageRes.ok) {
      const errText = await pageRes.text().catch(() => '');
      console.error('[generate-tests] Confluence API error:', pageRes.status, errText.substring(0, 200));
      return NextResponse.json(
        { error: `Confluence returned ${pageRes.status}. Check page ID and credentials.` },
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
    // Keep context small for faster Gemini response (critical for Vercel 10s timeout)
    const truncatedText = truncateForContext(plainText, 8000);

    // ─── Generate test cases for the specified pass ───────────────────────
    const provider = getAIProvider();

    let testCases;
    try {
      testCases = await generateTestCasesForPass(
        truncatedText,
        prdHeadings,
        pass as GenerationPass,
        existingTestCases,
        { maxTokens: 8192, temperature: 0.4, maxRetries: 1, contextTokenBudget: 8000 },
        provider
      );
      console.log(`[generate-tests] Pass "${pass}" generated ${testCases.length} test cases using ${provider.name}`);
    } catch (aiError: any) {
      const errorMessage = aiError?.message || 'AI generation failed';

      // Handle rate limit errors
      if (errorMessage.includes('429')) {
        const { iso, readableIST } = getNextResetTime();
        return NextResponse.json(
          { 
            error: `AI generation limit reached. Quota resets on ${readableIST}.`,
            resetTime: iso,
            resetTimeReadable: readableIST,
          },
          { status: 429, headers: { 'Retry-After': '60' } }
        );
      }

      console.error('[generate-tests] AI error:', errorMessage);
      return NextResponse.json(
        { error: `AI generation failed: ${errorMessage.substring(0, 100)}` },
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
    console.error('[generate-tests] Unexpected error:', err.message, err.stack);
    return NextResponse.json(
      { error: `Server error: ${err.message?.substring(0, 100)}` },
      { status: 500 }
    );
  }
}
