import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Calculates the next quota reset time.
 * Gemini free tier resets at midnight Pacific Time (PT).
 * Returns ISO string in UTC for the client to format in local timezone.
 */
function getNextResetTime(): { iso: string; readableIST: string } {
  const now = new Date();

  // Midnight Pacific = 8:00 AM UTC (PST) or 7:00 AM UTC (PDT)
  // During PDT (March-November): midnight PT = 07:00 UTC = 12:30 PM IST
  // During PST (November-March): midnight PT = 08:00 UTC = 1:30 PM IST
  // Determine if we're in PDT or PST
  const jan = new Date(now.getFullYear(), 0, 1);
  const jul = new Date(now.getFullYear(), 6, 1);
  const isDST = now.getTimezoneOffset() < Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
  // Actually, we need Pacific time DST check, not local
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

/**
 * Lightweight quota check — makes a minimal Gemini API call to verify
 * the daily quota hasn't been exhausted before starting generation.
 * Returns availability status with exact reset time.
 */
export async function GET() {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ 
      available: false, 
      reason: 'AI API key not configured. Contact your administrator.',
      resetTime: null,
    }, { status: 500 });
  }

  const model = 'gemini-2.0-flash-lite';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'OK' }] }],
        generationConfig: { maxOutputTokens: 3, temperature: 0 },
      }),
    });

    if (res.status === 429) {
      const { iso, readableIST } = getNextResetTime();
      return NextResponse.json({
        available: false,
        reason: `AI generation limit reached for today. Quota resets on ${readableIST}.`,
        resetTime: iso,
        resetTimeReadable: readableIST,
      });
    }

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({
        available: false,
        reason: `AI service temporarily unavailable. Please try again in a few minutes.`,
        resetTime: null,
      });
    }

    return NextResponse.json({ available: true, resetTime: null });
  } catch (err: any) {
    return NextResponse.json({
      available: false,
      reason: `Unable to reach AI service. Check your internet connection.`,
      resetTime: null,
    });
  }
}
