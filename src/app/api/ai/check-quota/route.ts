import { NextResponse } from 'next/server';
import { keyPool } from '@/lib/ai/providers/key-pool';
import { getCompatDb } from '@/lib/firebase-compat';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ai/check-quota
 *
 * Returns live quota stats from:
 * 1. Key pool — Gemini/Groq key availability (in-memory, per instance)
 * 2. Firestore ai_token_usage_daily — today's persistent call/token counts
 *    This survives across serverless cold starts unlike in-memory stats.
 */
export async function GET() {
  try {
    const poolStats = keyPool.getStats();

    const GEMINI_KEYS = poolStats.gemini.total;
    const GROQ_KEYS = poolStats.groq.total;
    const GEMINI_RPD_PER_KEY = 1500;
    const GROQ_RPD_PER_KEY = 14400;
    const geminiDailyLimit = GEMINI_KEYS * GEMINI_RPD_PER_KEY;
    const groqDailyLimit = GROQ_KEYS * GROQ_RPD_PER_KEY;
    const totalDailyLimit = geminiDailyLimit + groqDailyLimit;

    // ─── Read today's Firestore daily aggregate ───────────────────────────
    // This is written by persistToFirestore() in token-tracker.ts after every AI call
    const today = new Date().toISOString().substring(0, 10);
    let todayData: any = null;
    let firestoreError: string | null = null;

    try {
      const db = getCompatDb();
      const doc = await db.collection('ai_token_usage_daily').doc(today).get();
      if (doc.exists) {
        todayData = doc.data();
      }
    } catch (err: any) {
      firestoreError = err.message;
    }

    // ─── Build response ───────────────────────────────────────────────────
    const totalCalls = todayData?.totalCalls ?? 0;
    const totalTokens = todayData?.totalTokens ?? 0;
    const promptTokens = todayData?.totalPromptTokens ?? 0;
    const completionTokens = todayData?.totalCompletionTokens ?? 0;
    const byFeature = todayData?.byFeature ?? {};

    // Flatten byFeature into a sorted array for the badge UI
    const features = Object.entries(byFeature)
      .map(([feature, data]: [string, any]) => ({
        feature,
        calls: data.calls ?? 0,
        totalTokens: data.totalTokens ?? 0,
        avgPromptTokens: data.calls > 0 ? Math.round((data.promptTokens ?? 0) / data.calls) : 0,
        avgCompletionTokens: data.calls > 0 ? Math.round((data.completionTokens ?? 0) / data.calls) : 0,
        lastCalledAt: todayData?.lastUpdated ?? 0,
      }))
      .sort((a, b) => b.totalTokens - a.totalTokens);

    return NextResponse.json({
      providers: {
        gemini: {
          totalKeys: poolStats.gemini.total,
          availableKeys: poolStats.gemini.available,
          dailyLimit: geminiDailyLimit,
          rpdPerKey: GEMINI_RPD_PER_KEY,
        },
        groq: {
          totalKeys: poolStats.groq.total,
          availableKeys: poolStats.groq.available,
          dailyLimit: groqDailyLimit,
          rpdPerKey: GROQ_RPD_PER_KEY,
        },
      },
      totalDailyLimit,

      // Today's persistent stats from Firestore
      session: {
        calls: totalCalls,
        totalTokens,
        promptTokens,
        completionTokens,
      },

      features,
      date: today,
      source: firestoreError ? 'firestore_error' : (todayData ? 'firestore' : 'no_data_yet'),
      firestoreError,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
