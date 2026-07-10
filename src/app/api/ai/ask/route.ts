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

const SYSTEM_PROMPT = `You are a QA/PM assistant that answers questions about a single Product Requirements Document (PRD).

Rules:
- The user may write in casual, informal, or grammatically imperfect English (typos, missing articles, mixed phrasing). Understand their intent charitably — never correct their grammar, never comment on how they wrote the question, just answer it.
- Answer using ONLY the PRD content provided below. If the PRD doesn't specify something the user is asking about, say so explicitly (e.g. "The PRD doesn't define this — you may want to flag it with the PM"). Never invent details that aren't in the document.
- Always respond in clear, correct English, regardless of how the question was phrased.
- Keep answers concise and directly useful — a QA engineer or PM should be able to act on your answer immediately.
- When your answer is based on a specific part of the PRD, name the section/heading it came from, so the user can jump to it (e.g. "(see: Login Flow)").
- If asked something entirely unrelated to this PRD, politely redirect to PRD-related questions.`;

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
      console.error(`${provider.name} provider error:`, providerErr.message);
      return NextResponse.json({ answer: providerErr.message || 'AI request failed. Please try again.' });
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
