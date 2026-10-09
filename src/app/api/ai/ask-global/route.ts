import { NextRequest, NextResponse } from 'next/server';
import { extractPlainText, truncateForContext } from '@/lib/ai/extractText';
import { getAIProvider } from '@/lib/ai/providers';
import { getCompatDb } from '@/lib/firebase-compat';
import { withTokenTracking } from '@/lib/ai/token-tracker';
import { isAIEnabled } from '@/lib/ai/feature-flags';

export const dynamic = 'force-dynamic';

interface AskGlobalRequestBody {
  question: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
}

interface PrdIndexEntry {
  pageId: string;
  title: string;
  summary: string;
  headings: string[];
  updatedAt: number;
}

const SYSTEM_PROMPT = `You are a cross-PRD search assistant for Zenit's product team. You can answer questions that span multiple Product Requirements Documents (PRDs).

Rules:
- Answer using ONLY the PRD content provided below. If none of the PRDs cover the topic, say "None of the indexed PRDs cover this topic."
- At the end of your answer, cite which PRD(s) you used in the format: [Source: PRD Title]
- Be concise and direct. No filler, no repetition.
- Use plain text with clean formatting. Use "•" for bullet points.
- Use short paragraphs. One idea per paragraph.
- Never use markdown formatting like **, *, #, or code blocks.
- Keep answers actionable — a QA engineer or PM should be able to use your answer immediately.
- If the answer spans multiple PRDs, organize by PRD and note which parts come from which document.`;

const PRD_INDEX_COLLECTION = 'prd_index';
const INDEX_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Fetches all Confluence pages in the workspace.
 * Returns basic metadata (id, title) for semantic matching.
 */
async function fetchAllConfluencePages(): Promise<{ id: string; title: string }[]> {
  const baseUrl = process.env.CONFLUENCE_BASE_URL;
  const email = process.env.CONFLUENCE_EMAIL;
  const token = process.env.CONFLUENCE_API_TOKEN;

  if (!baseUrl || !email || !token) {
    throw new Error('Confluence not configured');
  }

  const authHeader = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;
  const allPages: { id: string; title: string }[] = [];
  let cursor: string | null = null;

  // Paginate through all pages (Confluence v2 API)
  do {
    const pageUrl: string = cursor
      ? `${baseUrl}/api/v2/pages?limit=50&sort=-modified-date&cursor=${cursor}`
      : `${baseUrl}/api/v2/pages?limit=50&sort=-modified-date`;

    const pageRes: Response = await fetch(pageUrl, {
      headers: { Authorization: authHeader, Accept: 'application/json' },
      cache: 'no-store',
    });

    if (!pageRes.ok) break;

    const pageData: any = await pageRes.json();
    const pages = pageData.results || [];
    allPages.push(...pages.map((p: any) => ({ id: p.id, title: p.title })));

    // Get next page cursor
    cursor = pageData._links?.next ? new URL(pageData._links.next, baseUrl).searchParams.get('cursor') : null;

    // Safety limit — don't fetch more than 200 pages
    if (allPages.length >= 200) break;
  } while (cursor);

  return allPages;
}

/**
 * Fetches a single Confluence page's content.
 */
async function fetchPageContent(pageId: string): Promise<{ title: string; plainText: string } | null> {
  const baseUrl = process.env.CONFLUENCE_BASE_URL;
  const email = process.env.CONFLUENCE_EMAIL;
  const token = process.env.CONFLUENCE_API_TOKEN;

  if (!baseUrl || !email || !token) return null;

  const authHeader = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;

  const res = await fetch(
    `${baseUrl}/api/v2/pages/${pageId}?body-format=storage`,
    { headers: { Authorization: authHeader, Accept: 'application/json' }, cache: 'no-store' }
  );

  if (!res.ok) return null;

  const data = await res.json();
  const html = data.body?.storage?.value || '';
  if (!html) return null;

  return {
    title: data.title || 'Untitled',
    plainText: extractPlainText(html),
  };
}

/**
 * Gets or refreshes the PRD index from Firestore.
 * The index stores page summaries + headings for fast semantic search.
 */
async function getPrdIndex(): Promise<PrdIndexEntry[]> {
  try {
    const db = getCompatDb();
    const indexRef = db.collection(PRD_INDEX_COLLECTION);
    const snapshot = await indexRef.get();

    const entries: PrdIndexEntry[] = [];
    const now = Date.now();

    snapshot.forEach((doc) => {
      const data = doc.data() as PrdIndexEntry;
      // Only use entries that aren't stale
      if (now - data.updatedAt < INDEX_TTL_MS) {
        entries.push(data);
      }
    });

    return entries;
  } catch {
    // If Firestore isn't available, return empty (will use live fetch)
    return [];
  }
}

/**
 * Indexes a page into Firestore for future fast search.
 */
async function indexPage(pageId: string, title: string, plainText: string): Promise<PrdIndexEntry> {
  // Extract headings from plain text
  const headings = plainText
    .split('\n')
    .filter(line => line.startsWith('#'))
    .map(line => line.replace(/^#+\s*/, '').trim())
    .slice(0, 20);

  // Create a summary (first 500 chars + headings)
  const summary = plainText.substring(0, 500).trim();

  const entry: PrdIndexEntry = {
    pageId,
    title,
    summary,
    headings,
    updatedAt: Date.now(),
  };

  try {
    const db = getCompatDb();
    await db.collection(PRD_INDEX_COLLECTION).doc(pageId).set(entry);
  } catch {
    // Silently fail — index is a cache optimization, not critical
  }

  return entry;
}

/**
 * Scores how relevant a PRD index entry is to a question.
 * Simple keyword-based scoring — fast and effective for our scale.
 */
function scoreRelevance(entry: PrdIndexEntry, question: string): number {
  const q = question.toLowerCase();
  const words = q.split(/\s+/).filter(w => w.length > 2);
  let score = 0;

  // Title match is highest signal
  const titleLower = entry.title.toLowerCase();
  for (const word of words) {
    if (titleLower.includes(word)) score += 10;
  }

  // Heading matches are strong signal
  for (const heading of entry.headings) {
    const headingLower = heading.toLowerCase();
    for (const word of words) {
      if (headingLower.includes(word)) score += 5;
    }
  }

  // Summary/content matches
  const summaryLower = entry.summary.toLowerCase();
  for (const word of words) {
    if (summaryLower.includes(word)) score += 2;
  }

  return score;
}

export async function POST(req: NextRequest) {
  try {
    const body: AskGlobalRequestBody = await req.json();
    const { question, history = [] } = body;

    if (!question?.trim()) {
      return NextResponse.json(
        { error: 'question is required' },
        { status: 400 }
      );
    }

    // ─── Feature flag check ───────────────────────────────────────────────
    if (!await isAIEnabled('ask-global')) {
      return NextResponse.json({ answer: 'Global PRD Search AI is currently disabled. Enable it in AI Settings.', sources: [] });
    }

    // ─── Step 1: Get PRD index (cached in Firestore) ─────────────────────
    let prdIndex = await getPrdIndex();

    // If index is empty or stale, rebuild from Confluence
    if (prdIndex.length === 0) {
      const pages = await fetchAllConfluencePages();

      // Index all pages (fetch content for each)
      const indexPromises = pages.slice(0, 30).map(async (page) => {
        const content = await fetchPageContent(page.id);
        if (content) {
          return indexPage(page.id, content.title, content.plainText);
        }
        return null;
      });

      const results = await Promise.allSettled(indexPromises);
      prdIndex = results
        .filter((r): r is PromiseFulfilledResult<PrdIndexEntry | null> => r.status === 'fulfilled')
        .map(r => r.value)
        .filter((e): e is PrdIndexEntry => e !== null);
    }

    if (prdIndex.length === 0) {
      return NextResponse.json({
        answer: "No PRDs found in Confluence. Make sure your Confluence integration is configured and you have pages in your space.",
        sources: [],
      });
    }

    // ─── Step 2: Find relevant PRDs using semantic scoring ───────────────
    const scored = prdIndex
      .map(entry => ({ entry, score: scoreRelevance(entry, question) }))
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5); // Top 5 matches

    // If no matches by keyword, use the 3 most recently updated PRDs
    const topEntries = scored.length > 0
      ? scored.map(s => s.entry)
      : prdIndex.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3);

    // ─── Step 3: Fetch full content of top matching PRDs ─────────────────
    const contextParts: { title: string; content: string; pageId: string }[] = [];
    const maxTotalChars = 40000; // ~10k tokens budget for context
    let totalChars = 0;

    for (const entry of topEntries) {
      if (totalChars >= maxTotalChars) break;

      const page = await fetchPageContent(entry.pageId);
      if (!page) continue;

      const truncated = truncateForContext(page.plainText, 3000); // ~3000 tokens per PRD
      contextParts.push({
        title: page.title,
        content: truncated,
        pageId: entry.pageId,
      });
      totalChars += truncated.length;
    }

    if (contextParts.length === 0) {
      return NextResponse.json({
        answer: "I found some PRDs but couldn't fetch their content. The Confluence API might be temporarily unavailable.",
        sources: [],
      });
    }

    // ─── Step 4: Build multi-PRD context and call AI ─────────────────────
    const prdContext = contextParts
      .map((p, i) => `\n\n═══ PRD ${i + 1}: "${p.title}" ═══\n\n${p.content}`)
      .join('');

    const fullSystemPrompt = `${SYSTEM_PROMPT}\n\n--- RELEVANT PRDs (${contextParts.length} documents) ---${prdContext}`;

    const provider = getAIProvider();
    let result;

    try {
      result = await withTokenTracking(
        'ask-global',
        provider.name,
        'gemini-2.0-flash-lite',
        () => provider.askAI({ systemPrompt: fullSystemPrompt, history, question }),
        { question }
      );
    } catch (providerErr: any) {
      const msg = providerErr?.message || '';
      console.error(`[Global AI] ${provider.name} error:`, msg);

      if (msg.includes('429') || msg.includes('quota') || msg.includes('Quota')) {
        return NextResponse.json({
          answer: "AI quota reached. Try again after midnight PT, or add more API keys.",
          sources: [],
        });
      }
      return NextResponse.json({
        answer: 'AI request failed. Please try again in a moment.',
        sources: [],
      });
    }

    // ─── Step 5: Return answer with source PRD references ────────────────
    const sources = contextParts.map(p => ({
      pageId: p.pageId,
      title: p.title,
    }));

    return NextResponse.json({
      answer: result.answer,
      sources,
      provider: provider.name,
      prdCount: prdIndex.length,
      usage: result.usage,
    });
  } catch (err: any) {
    console.error('[Global AI] Error:', err.message);
    return NextResponse.json({
      answer: 'Something went wrong: ' + (err.message || 'Unknown error'),
      sources: [],
    });
  }
}
