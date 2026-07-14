import { NextRequest } from 'next/server';
import { extractPlainText, truncateForContext } from '@/lib/ai/extractText';
import { extractHeadings } from '@/lib/ai/testCaseGenerator';
import { getAIProvider } from '@/lib/ai/providers';
import { getCachedPageContent, setCachedPageContent } from '@/lib/ai/cache';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Phase 7: Server-Sent Events (SSE) streaming endpoint for test case generation.
 * Instead of waiting for the full AI response, streams test cases as they are parsed.
 *
 * Protocol:
 *   - event: progress — { pass, status, message }
 *   - event: testcases — { testCases: [...], pass, batchIndex }
 *   - event: complete — { totalGenerated, modelUsed }
 *   - event: error — { message }
 */
export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  const body = await req.json();
  const { pageId, passes = ['functional_sanity', 'negative_edge', 'exploratory_more'] } = body;

  if (!pageId) {
    return new Response(
      JSON.stringify({ error: 'pageId is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: any) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // ─── Fetch page content ──────────────────────────────────────────
        send('progress', { pass: 0, status: 'fetching', message: 'Loading PRD content...' });

        let plainText: string;
        const cachedPage = getCachedPageContent(pageId);

        if (cachedPage) {
          plainText = cachedPage.plainText;
        } else {
          const baseUrl = process.env.CONFLUENCE_BASE_URL;
          const email = process.env.CONFLUENCE_EMAIL;
          const token = process.env.CONFLUENCE_API_TOKEN;

          if (!baseUrl || !email || !token) {
            send('error', { message: 'Confluence not configured' });
            controller.close();
            return;
          }

          const authHeader = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;
          const pageRes = await fetch(
            `${baseUrl}/api/v2/pages/${pageId}?body-format=storage`,
            { headers: { Authorization: authHeader, Accept: 'application/json' }, cache: 'no-store' }
          );

          if (!pageRes.ok) {
            send('error', { message: 'Page not found' });
            controller.close();
            return;
          }

          const pageData = await pageRes.json();
          const pageBody = pageData.body?.storage?.value || '';
          if (!pageBody) {
            send('error', { message: 'Page has no content' });
            controller.close();
            return;
          }

          plainText = extractPlainText(pageBody);
          setCachedPageContent(pageId, plainText, pageData.title || 'Untitled');
        }

        const prdHeadings = extractHeadings(plainText);
        const truncatedText = truncateForContext(plainText, 8000);
        const provider = getAIProvider();

        // ─── Stream each pass ────────────────────────────────────────────
        let totalGenerated = 0;
        const allCases: any[] = [];

        for (let i = 0; i < passes.length; i++) {
          const pass = passes[i];
          const passNames: Record<string, string> = {
            functional_sanity: 'Functional & Sanity',
            negative_edge: 'Negative & Edge Cases',
            exploratory_more: 'Exploratory',
            web: 'Web Platform',
            tv: 'TV Platform',
            mobile: 'Mobile Platform',
            all: 'All Platforms',
            analytics: 'Analytics Events',
          };

          send('progress', {
            pass: i + 1,
            status: 'generating',
            message: `Generating ${passNames[pass] || pass} test cases...`,
            totalPasses: passes.length,
          });

          try {
            // Dynamic import to avoid circular deps
            const { generateTestCasesForPass, getIdCountersFromCases } = await import('@/lib/ai/testCaseGenerator');

            const existingSummary = allCases.map(tc => ({
              id: tc.testcaseId,
              scenario: tc.testScenario,
              category: tc.category,
            }));

            const startCounters = allCases.length > 0 ? getIdCountersFromCases(allCases) : undefined;

            const testCases = await generateTestCasesForPass(
              truncatedText,
              prdHeadings,
              pass as any,
              existingSummary,
              { maxTokens: 8192, temperature: 0.4, maxRetries: 1, contextTokenBudget: 8000 },
              provider,
              startCounters
            );

            allCases.push(...testCases);
            totalGenerated += testCases.length;

            // Stream this batch immediately
            send('testcases', {
              testCases,
              pass: i + 1,
              passName: passNames[pass] || pass,
              batchIndex: i,
              batchCount: testCases.length,
            });
          } catch (passErr: any) {
            const msg = passErr?.message || 'Unknown error';
            if (msg.includes('429')) {
              send('error', { message: 'AI quota exhausted. Partial results delivered above.' });
              break;
            }
            send('progress', {
              pass: i + 1,
              status: 'warning',
              message: `Pass "${pass}" failed: ${msg.substring(0, 80)}. Continuing...`,
            });
          }
        }

        // ─── Complete ────────────────────────────────────────────────────
        send('complete', {
          totalGenerated,
          modelUsed: provider.name,
          passesCompleted: passes.length,
        });
      } catch (err: any) {
        send('error', { message: err.message || 'Stream generation failed' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
