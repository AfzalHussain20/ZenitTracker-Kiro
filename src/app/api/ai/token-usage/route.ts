import { NextRequest, NextResponse } from 'next/server';
import { getInMemoryStats } from '@/lib/ai/token-tracker';
import { getCompatDb } from '@/lib/firebase-compat';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ai/token-usage
 * Returns combined in-memory + Firestore token usage stats.
 *
 * Query params:
 *   ?days=7  — how many days of daily history to include (default: 7)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const days = Math.min(parseInt(searchParams.get('days') || '7', 10), 30);

    // 1. In-memory stats (current server instance)
    const memStats = getInMemoryStats();

    // 2. Daily history from Firestore
    const db = getCompatDb();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().substring(0, 10);

    const dailySnap = await db
      .collection('ai_token_usage_daily')
      .where('date', '>=', cutoffStr)
      .orderBy('date', 'desc')
      .get();

    const dailyHistory: any[] = [];
    dailySnap.forEach((doc) => {
      dailyHistory.push({ id: doc.id, ...doc.data() });
    });

    // 3. Recent individual events from Firestore (last 100 calls)
    const recentSnap = await db
      .collection('ai_token_usage')
      .orderBy('timestamp', 'desc')
      .limit(100)
      .get();

    const recentEvents: any[] = [];
    recentSnap.forEach((doc) => {
      recentEvents.push({ id: doc.id, ...doc.data() });
    });

    return NextResponse.json({
      // Aggregates per feature (in-memory, resets on server restart)
      aggregates: memStats.aggregates,
      // Running totals for this server instance
      instanceTotals: memStats.totals,
      // Daily rollups from Firestore (persistent across restarts)
      dailyHistory,
      // Last 100 individual AI calls from Firestore
      recentEvents,
      // Combined daily totals across the requested window
      windowTotals: dailyHistory.reduce(
        (acc, d) => ({
          calls: acc.calls + (d.totalCalls || 0),
          promptTokens: acc.promptTokens + (d.totalPromptTokens || 0),
          completionTokens: acc.completionTokens + (d.totalCompletionTokens || 0),
          totalTokens: acc.totalTokens + (d.totalTokens || 0),
        }),
        { calls: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0 }
      ),
      days,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[token-usage] Error:', err.message);
    // Return in-memory only on Firestore failure
    const memStats = getInMemoryStats();
    return NextResponse.json({
      aggregates: memStats.aggregates,
      instanceTotals: memStats.totals,
      dailyHistory: [],
      recentEvents: memStats.recentEvents,
      windowTotals: memStats.totals,
      days: 0,
      generatedAt: new Date().toISOString(),
      error: 'Firestore unavailable — showing in-memory stats only',
    });
  }
}
