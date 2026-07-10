import { NextRequest, NextResponse } from 'next/server';
import { extractPlainText, truncateForContext } from '@/lib/ai/extractText';
import { getAIProvider } from '@/lib/ai/providers';
import {
  getCacheKey, getCachedResponse, setCachedResponse,
  getCachedPageContent, setCachedPageContent,
} from '@/lib/ai/cache';

export const dynamic = 'force-dynamic';

interface AskRequestBody {
  pageId: string;
  question: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
}

const SYSTEM_PROMPT = `You are a helpful QA/PM assistant. You answer questions about a Product Requirements Document (PRD).

Rules:
- Answer using ONLY the PRD content provided below. If something isn't specified, say "The PRD doesn't cover this."
- Be concise and direct. No filler, no repetition.
- Use plain text with clean formatting. Use "•" for bullet points (never * or -).
- Use short paragraphs. One idea per paragraph.
- When referencing a PRD section, mention it naturally like "In the Login Flow section..." — do NOT use "(see: Section)" format.
- Never use markdown formatting like **, *, #, or code blocks. Just plain readable text.
- If the user's English is casual or has typos, understand their intent and answer clearly.
- Keep answers actionable — a QA engineer should be able to use your answer immediately.`;

export async function POST(req: NextRequest) {
  try {
    const body: AskRequestBody = await req.json();
    const { pageId, question, history = [] } = body;

    if (!pageId || !question?.trim()) {
      return NextResponse.json(
        { error: 'pageId and question are required' },
        { status: 400 }
      );
    }

    // ─── Get PRD content (cached or fresh) ────────────────────────────────
    let plainText: string;
    let pageTitle: string;

    const cached = getCachedPageContent(pageId);
    if (cached) {
      plainText = cached.plainText;
      pageTitle = cached.title;
    } else {
      // Fetch from Confluence
      const baseUrl = process.env.CONFLUENCE_BASE_URL;
      const email = process.env.CONFLUENCE_EMAIL;
      const token = process.env.CONFLUENCE_API_TOKEN;

      if (!baseUrl || !email || !token) {
        return NextResponse.json({ error: 'Confluence not configured' }, { status: 500 });
      }

      const authHeader = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;
      const pageRes = await fetch(
        `${baseUrl}/api/v2/pages/${pageId}?body-format=storage`,
        { headers: { Authorization: authHeader, Accept: 'application/json' }, cache: 'no-store' }
      );

      if (!pageRes.ok) {
        return NextResponse.json({ error: 'Page not found' }, { status: 404 });
      }

      const pageData = await pageRes.json();
      const pageBody = pageData.body?.storage?.value || '';
      pageTitle = pageData.title || 'Untitled';

      if (!pageBody) {
        return NextResponse.json({ error: 'Page has no content' }, { status: 404 });
      }

      plainText = extractPlainText(pageBody);
      // Cache the page content for subsequent questions
      setCachedPageContent(pageId, plainText, pageTitle);
    }

    // ─── Check AI response cache ──────────────────────────────────────────
    const prdContext = truncateForContext(plainText, 12000);
    const fullSystemPrompt = `${SYSTEM_PROMPT}\n\n--- PRD: "${pageTitle}" ---\n\n${prdContext}`;

    const cacheKey = getCacheKey(fullSystemPrompt, question, history.length);
    const cachedAnswer = getCachedResponse(cacheKey);

    if (cachedAnswer) {
      const citeMatch = cachedAnswer.match(/\(see:\s*([^)]+)\)/i);
      const citedSection = citeMatch ? citeMatch[1].trim() : null;
      return NextResponse.json({ answer: cachedAnswer, citedSection, provider: 'cache' });
    }

    // ─── Call AI provider ─────────────────────────────────────────────────
    const provider = getAIProvider();
    let result;
    try {
      result = await provider.askAI({
        systemPrompt: fullSystemPrompt,
        history,
        question,
      });
    } catch (providerErr: any) {
      const msg = providerErr?.message || '';
      console.error(`${provider.name} provider error:`, msg);
      
      // Friendly error for quota issues
      if (msg.includes('429') || msg.includes('quota') || msg.includes('Quota')) {
        return NextResponse.json({ 
          answer: "AI quota reached for today. Add a GROQ_API_KEY to your environment for unlimited fallback, or try again after midnight PT." 
        });
      }
      return NextResponse.json({ answer: 'AI request failed. Please try again in a moment.' });
    }

    // Cache the response for repeat questions
    setCachedResponse(cacheKey, result.answer);

    // Extract cited section if present
    const citeMatch = result.answer.match(/\(see:\s*([^)]+)\)/i);
    const citedSection = citeMatch ? citeMatch[1].trim() : null;

    return NextResponse.json({
      answer: result.answer,
      citedSection,
      provider: provider.name,
    });
  } catch (err: any) {
    console.error('Error in /api/ai/ask:', err.message);
    return NextResponse.json({ answer: 'Something went wrong: ' + (err.message || 'Unknown error. Please try again.') });
  }
}
