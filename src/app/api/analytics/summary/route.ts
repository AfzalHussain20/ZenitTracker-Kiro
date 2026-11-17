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

    const ordered = await db
      .collection(COLLECTION)
      .orderBy('createdAt', 'desc')
      .limit(MAX_ROWS)
      .get();

    // Firestore's ordered query silently excludes documents missing the order
    // field, and the two event writers disagree: the track API sets
    // `createdAt` while `clevertap-analytics` only sets `timestamp`. A plain
    // read catches those rows. It is only affordable (and only complete) when
    // the ordered read did not hit the cap; when it did we report truncation.
    const capped = ordered.size >= MAX_ROWS;
    const plain = capped ? null : await db.collection(COLLECTION).limit(MAX_ROWS).get();

    const byId = new Map<string, Record<string, any>>();
    for (const doc of ordered.docs) byId.set(doc.id, { id: doc.id, ...doc.data() });
    for (const doc of plain?.docs ?? []) {
      if (!byId.has(doc.id)) byId.set(doc.id, { id: doc.id, ...doc.data() });
    }

    const events = [...byId.values()];
    const summary = summarizeEvents(events, {
      windowDays: days,
      truncated: capped,
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
