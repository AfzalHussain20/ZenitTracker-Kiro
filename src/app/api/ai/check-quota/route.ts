import { NextResponse } from 'next/server';
import { keyPool } from '@/lib/ai/providers/key-pool';
import { getInMemoryStats } from '@/lib/ai/token-tracker';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ai/check-quota
 *
 * Returns live quota stats from two sources:
 * 1. Key pool — actual request counts tracked per Gemini/Groq key (reliable, in-memory)
 * 2. Token tracker — token usage aggregates (populated when withTokenTracking is used)
 *
 * This is the primary source for the TokenQuotaBadge since Firestore
 * writes can fail when Firebase Admin isn't configured, but key pool
 * stats are always available within a server instance.
 */
export async function GET() {
  try {
    const poolStats = keyPool.getStats();
    const memStats = getInMemoryStats();

    // Calculate total requests made across all keys today
    // Note: requestCount resets on server restart, but this is our best live signal
    const geminiTotalRequests = poolStats.gemini.total;
    const groqTotalRequests = poolStats.groq.total;

    // Key pool daily limits
    const GEMINI_KEYS = poolStats.gemini.total;
    const GROQ_KEYS = poolStats.groq.total;
    const GEMINI_RPD_PER_KEY = 1500;
    const GROQ_RPD_PER_KEY = 14400;
    const geminiDailyLimit = GEMINI_KEYS * GEMINI_RPD_PER_KEY;
    const groqDailyLimit = GROQ_KEYS * GROQ_RPD_PER_KEY;
    const totalDailyLimit = geminiDailyLimit + groqDailyLimit;

    // In-memory call counts (resets on cold start but tracks current session accurately)
    const sessionCalls = memStats.totals.calls;
    const sessionTokens = memStats.totals.totalTokens;
    const sessionPromptTokens = memStats.totals.promptTokens;
    const sessionCompletionTokens = memStats.totals.completionTokens;

    // Per-feature breakdown
    const featureBreakdown = memStats.aggregates.map(a => ({
      feature: a.feature,
      calls: a.callCount,
      totalTokens: a.totalTokens,
      avgPromptTokens: a.avgPromptTokens,
      avgCompletionTokens: a.avgCompletionTokens,
      lastCalledAt: a.lastCalledAt,
    }));

    // Recent events (last 20)
    const recentEvents = memStats.recentEvents.slice(0, 20).map(e => ({
      feature: e.feature,
      provider: e.provider,
      promptTokens: e.promptTokens,
      completionTokens: e.completionTokens,
      totalTokens: e.totalTokens,
      durationMs: e.durationMs,
      timestamp: e.timestamp,
    }));

    return NextResponse.json({
      // Key pool state
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

      // Session stats (since last cold start)
      session: {
        calls: sessionCalls,
        totalTokens: sessionTokens,
        promptTokens: sessionPromptTokens,
        completionTokens: sessionCompletionTokens,
      },

      // Per-feature breakdown
      features: featureBreakdown,

      // Recent individual calls
      recentEvents,

      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
