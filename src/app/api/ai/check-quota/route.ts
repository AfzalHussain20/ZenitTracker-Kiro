import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Lightweight quota check — makes a minimal Gemini API call to verify
 * the daily quota hasn't been exhausted before starting generation.
 */
export async function GET() {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ available: false, reason: 'GOOGLE_AI_API_KEY not configured' }, { status: 500 });
  }

  const model = 'gemini-2.0-flash-lite';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Say OK' }] }],
        generationConfig: { maxOutputTokens: 5, temperature: 0 },
      }),
    });

    if (res.status === 429) {
      return NextResponse.json({
        available: false,
        reason: 'Daily AI quota exhausted. Quota resets at midnight Pacific time. Try again later.',
      });
    }

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({
        available: false,
        reason: `AI provider error (${res.status}): ${errText.substring(0, 100)}`,
      });
    }

    return NextResponse.json({ available: true });
  } catch (err: any) {
    return NextResponse.json({
      available: false,
      reason: `Network error: ${err.message}`,
    });
  }
}
