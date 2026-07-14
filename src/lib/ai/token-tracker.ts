/**
 * Token Usage Tracker
 *
 * Tracks prompt + completion tokens for every AI call across all routes.
 * Stores per-call logs in Firestore (ai_token_usage collection) and keeps
 * an in-memory aggregate for the current server instance for fast reads.
 *
 * Firestore document shape:
 *   ai_token_usage/{auto-id}  — one doc per AI call
 *   ai_token_usage_daily/{YYYY-MM-DD} — daily aggregates (upserted)
 */

import { getAdminDb } from '@/lib/firebaseAdmin';

export type AIFeature =
  | 'ask-prd'
  | 'ask-global'
  | 'generate-tests'
  | 'generate-tests-stream'
  | 'jira-insights'
  | 'categorize-prd'
  | 'generate-from-dictionary'
  | 'analytics-events'
  | 'notes-title'
  | 'other';

export interface TokenEvent {
  feature: AIFeature;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  durationMs?: number;
  timestamp: number;
  userId?: string;
  pageId?: string;
  question?: string; // first 120 chars only
}

export interface TokenAggregate {
  feature: AIFeature;
  callCount: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  avgPromptTokens: number;
  avgCompletionTokens: number;
  lastCalledAt: number;
}

// ─── In-memory accumulator (per server instance) ──────────────────────────────

const inMemoryEvents: TokenEvent[] = [];
const MAX_MEMORY_EVENTS = 200;

// Aggregate per feature for the current server instance
const inMemoryAggregates = new Map<AIFeature, TokenAggregate>();

/**
 * Records a token usage event. Persists to Firestore asynchronously (fire-and-forget).
 */
export function trackTokenUsage(event: TokenEvent): void {
  // Update in-memory
  inMemoryEvents.push(event);
  if (inMemoryEvents.length > MAX_MEMORY_EVENTS) {
    inMemoryEvents.shift(); // drop oldest
  }

  const existing = inMemoryAggregates.get(event.feature);
  if (existing) {
    existing.callCount++;
    existing.promptTokens += event.promptTokens;
    existing.completionTokens += event.completionTokens;
    existing.totalTokens += event.totalTokens;
    existing.avgPromptTokens = Math.round(existing.promptTokens / existing.callCount);
    existing.avgCompletionTokens = Math.round(existing.completionTokens / existing.callCount);
    existing.lastCalledAt = event.timestamp;
  } else {
    inMemoryAggregates.set(event.feature, {
      feature: event.feature,
      callCount: 1,
      promptTokens: event.promptTokens,
      completionTokens: event.completionTokens,
      totalTokens: event.totalTokens,
      avgPromptTokens: event.promptTokens,
      avgCompletionTokens: event.completionTokens,
      lastCalledAt: event.timestamp,
    });
  }

  // Persist to Firestore (non-blocking)
  persistToFirestore(event).catch((err) =>
    console.error('[TokenTracker] Firestore write failed:', err.message)
  );
}

async function persistToFirestore(event: TokenEvent): Promise<void> {
  try {
    const db = getAdminDb();
    const batch = db.batch();

    // 1. Add individual event doc
    const eventRef = db.collection('ai_token_usage').doc();
    batch.set(eventRef, event);

    // 2. Upsert daily aggregate
    const day = new Date(event.timestamp).toISOString().substring(0, 10);
    const dailyRef = db.collection('ai_token_usage_daily').doc(day);

    // We use FieldValue.increment for atomic aggregation
    const { FieldValue } = await import('firebase-admin/firestore');
    batch.set(
      dailyRef,
      {
        date: day,
        totalCalls: FieldValue.increment(1),
        totalPromptTokens: FieldValue.increment(event.promptTokens),
        totalCompletionTokens: FieldValue.increment(event.completionTokens),
        totalTokens: FieldValue.increment(event.totalTokens),
        lastUpdated: event.timestamp,
        byFeature: {
          [event.feature]: {
            calls: FieldValue.increment(1),
            promptTokens: FieldValue.increment(event.promptTokens),
            completionTokens: FieldValue.increment(event.completionTokens),
            totalTokens: FieldValue.increment(event.totalTokens),
          },
        },
      },
      { merge: true }
    );

    await batch.commit();
  } catch {
    // Silently fail — token tracking is non-critical
  }
}

/**
 * Returns the current in-memory aggregate stats for the dashboard.
 */
export function getInMemoryStats(): {
  recentEvents: TokenEvent[];
  aggregates: TokenAggregate[];
  totals: { calls: number; promptTokens: number; completionTokens: number; totalTokens: number };
} {
  const aggregates = Array.from(inMemoryAggregates.values()).sort(
    (a, b) => b.lastCalledAt - a.lastCalledAt
  );

  const totals = aggregates.reduce(
    (acc, a) => ({
      calls: acc.calls + a.callCount,
      promptTokens: acc.promptTokens + a.promptTokens,
      completionTokens: acc.completionTokens + a.completionTokens,
      totalTokens: acc.totalTokens + a.totalTokens,
    }),
    { calls: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  );

  return {
    recentEvents: [...inMemoryEvents].reverse().slice(0, 50),
    aggregates,
    totals,
  };
}

/**
 * Estimates token count from a string (rough approximation: 1 token ≈ 4 chars).
 * Used for showing expected tokens before the call is made.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Wraps an AI provider call, measuring duration and tracking usage.
 */
export async function withTokenTracking<T extends { answer: string; usage?: { promptTokens: number; completionTokens: number; totalTokens: number } }>(
  feature: AIFeature,
  provider: string,
  model: string,
  call: () => Promise<T>,
  context?: { userId?: string; pageId?: string; question?: string }
): Promise<T & { usage: { promptTokens: number; completionTokens: number; totalTokens: number } }> {
  const start = Date.now();
  const result = await call();
  const durationMs = Date.now() - start;

  const usage = result.usage ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  trackTokenUsage({
    feature,
    provider,
    model,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    totalTokens: usage.totalTokens,
    durationMs,
    timestamp: Date.now(),
    userId: context?.userId,
    pageId: context?.pageId,
    question: context?.question?.substring(0, 120),
  });

  return { ...result, usage };
}
