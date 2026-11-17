import { NextRequest, NextResponse } from 'next/server';
import { getCompatDb } from '@/lib/firebase-compat';
import {
  getRequestUser,
  unauthorized,
  forbidden,
  isInternalEmail,
} from '@/lib/server/request-auth';
import { summarizeEvents } from '@/lib/analytics-summary';

export const dynamic = 'force-dynamic';

const COLLECTION = 'analytics_events';
// Cap the read so one request can never pull an unbounded collection. The
// dashboard reports `truncated` when the cap is hit.
const MAX_ROWS = 5000;

/**
 * GET /api/analytics/summary?days=30
 *
 * Staff-only usage summary over the `analytics_events` collection. The raw
 * events are read server-side as the service account and reduced to counts;
 * the browser never receives the full event stream.
 */
export async function GET(req: NextRequest) {
  const user = await getRequestUser(req);
  if (!user) return unauthorized();
  if (!isInternalEmail(user.email)) {
    return forbidden('Usage analytics is available to Sun Network staff only');
  }

  const requested = parseInt(req.nextUrl.searchParams.get('days') || '30', 10);
  const days = Math.min(Math.max(Number.isFinite(requested) ? requested : 30, 1), 90);

  try {
    const db = getCompatDb();

    let snap = await db
      .collection(COLLECTION)
      .orderBy('createdAt', 'desc')
      .limit(MAX_ROWS)
      .get();

    // Older writers did not set `createdAt`, and an ordered query excludes
    // documents missing the order field. Fall back to a plain read so those
    // events still count instead of silently disappearing.
    if (snap.empty) {
      snap = await db.collection(COLLECTION).limit(MAX_ROWS).get();
    }

    const events = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const summary = summarizeEvents(events, {
      windowDays: days,
      truncated: snap.size >= MAX_ROWS,
    });

    return NextResponse.json(summary);
  } catch (err: any) {
    console.error('[api/analytics/summary] failed:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to load analytics' },
      { status: 500 },
    );
  }
}
