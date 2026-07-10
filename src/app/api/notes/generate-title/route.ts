import { NextRequest, NextResponse } from 'next/server';
import { getAIProvider } from '@/lib/ai/providers';
import { getCacheKey, getCachedResponse, setCachedResponse } from '@/lib/ai/cache';

export async function POST(req: NextRequest) {
  try {
    const { content } = await req.json();

    if (!content || content.length < 30) {
      return NextResponse.json({ title: '', tags: [], category: 'general' });
    }

    // Check cache — same content = same title
    const cacheKey = getCacheKey('note-title', content.substring(0, 500), 0);
    const cached = getCachedResponse(cacheKey);
    if (cached) {
      try {
        return NextResponse.json(JSON.parse(cached));
      } catch { /* fall through to fresh generation */ }
    }

    const systemPrompt = 'You analyze notes and return structured metadata. Respond with ONLY a JSON object.';
    const question = `Analyze this note and respond with ONLY a JSON object (no markdown, no backticks):
{
  "title": "a concise 5-8 word title summarizing the note",
  "tags": ["3-5 relevant single-word tags"],
  "category": "one of: meeting, todo, idea, reference, bug, general"
}

Note content:
${content.substring(0, 1000)}`;

    const provider = getAIProvider();
    let result;
    try {
      result = await provider.askAI({ systemPrompt, history: [], question });
    } catch (err: any) {
      // Graceful fallback — don't break the notes feature
      const fallbackTitle = content.substring(0, 50).replace(/\n/g, ' ').trim();
      return NextResponse.json({ title: fallbackTitle, tags: [], category: 'general' });
    }

    // Parse the JSON response
    const text = result.answer || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        const response = {
          title: parsed.title || content.substring(0, 50),
          tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : [],
          category: parsed.category || 'general',
        };
        // Cache it
        setCachedResponse(cacheKey, JSON.stringify(response));
        return NextResponse.json(response);
      } catch { /* fall through */ }
    }

    const fallback = {
      title: content.substring(0, 50).replace(/\n/g, ' ').trim(),
      tags: [],
      category: 'general',
    };
    return NextResponse.json(fallback);
  } catch (error: any) {
    console.error('AI title generation error:', error);
    return NextResponse.json({ title: '', tags: [], category: 'general' });
  }
}
