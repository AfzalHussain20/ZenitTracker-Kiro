import { NextRequest, NextResponse } from 'next/server';
import { getCompatDb } from '@/lib/firebase-compat';
import {
  getRequestUser,
  unauthorized,
  forbidden,
  isInternalEmail,
} from '@/lib/server/request-auth';

export const dynamic = 'force-dynamic';

const COLLECTION = 'analytics_events';
// A single event should be tiny. Refuse anything that could be used to stuff
// the collection with large blobs.
const MAX_BODY_BYTES = 8 * 1024;
const MAX_EVENT_NAME = 120;
const MAX_PROPERTIES_BYTES = 4 * 1024;

/**
 * POST /api/analytics/track
 *
 * Server-side endpoint to receive analytics events (e.g. beaconed from the
 * client when fetch to CleverTap is unavailable, or from server-rendered
 * flows). When CLEVERTAP credentials are configured the event is forwarded;
 * otherwise it is persisted to Firestore `analytics_events` so nothing is
 * lost before you have a key.
 *
 * Body: { eventName, properties, userId, userName, domain, sessionId }
 */

export async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    if (!user) return unauthorized();

    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Event payload too large' }, { status: 413 });
    }

    let body: any;
    try {
      body = JSON.parse(raw || '{}');
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { eventName, properties = {}, domain = 'user_action', sessionId } = body;
    // Never trust client-supplied identity: `userId` and `userName` are derived
    // from the signed session so activity cannot be attributed to someone else.
    const userId = user.uid;
    const userName = user.email ? user.email.split('@')[0] : 'anonymous';
    const safeDomain = typeof domain === 'string' && domain ? domain.slice(0, 40) : 'user_action';
    const safeSessionId =
      typeof sessionId === 'string' && sessionId
        ? sessionId.slice(0, 100)
        : `server_session_${Date.now()}`;
    const safeProps =
      properties && typeof properties === 'object' && !Array.isArray(properties)
        ? properties
        : {};

    if (typeof eventName !== 'string' || !eventName.trim()) {
      return NextResponse.json({ error: 'eventName is required' }, { status: 400 });
    }
    if (eventName.length > MAX_EVENT_NAME) {
      return NextResponse.json({ error: 'eventName too long' }, { status: 400 });
    }
    if (JSON.stringify(safeProps).length > MAX_PROPERTIES_BYTES) {
      return NextResponse.json({ error: 'properties too large' }, { status: 413 });
    }

    const event = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      timestamp: new Date().toISOString(),
      eventType: eventName.trim(),
      domain: safeDomain,
      userId: userId || 'anonymous',
      userName,
      metadata: {
        ...safeProps,
        source: safeProps.source || 'D2C',
        appName: safeProps.appName || 'Zenit Tracker',
        $D_timestamp: Date.now(),
        sessionId: safeSessionId,
      },
      sessionId: safeSessionId,
      createdAt: Date.now(),
    };

    // Persist locally regardless of CleverTap key (single source of truth).
    try {
      const db = getCompatDb();
      await db.collection(COLLECTION).doc(event.id).set(event);
    } catch (err) {
      console.error('[api/analytics/track] Firestore write failed:', err);
    }

    // Forward to CleverTap when credentials exist (hook for real SDK).
    const accountId = process.env.CLEVERTAP_ACCOUNT_ID;
    const token = process.env.CLEVERTAP_TOKEN;
    if (accountId && token) {
      try {
        // TODO: forward to CleverTap REST / SDK once key is provisioned.
        // e.g. await fetch(`https://api.clevertap.com/1/upload`, {...})
      } catch {
        // swallow — Firestore copy is the safety net
      }
    }

    return NextResponse.json({ id: event.id, accepted: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * GET /api/analytics/track?eventType=...&domain=...&limit=...
 * Raw event dump for debugging. Staff only: the events contain user ids and
 * names, so external accounts must not be able to read the whole stream.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    if (!user) return unauthorized();
    if (!isInternalEmail(user.email)) {
      return forbidden('Usage analytics is available to Sun Network staff only');
    }

    const { searchParams } = new URL(req.url);
    const eventType = searchParams.get('eventType');
    const domain = searchParams.get('domain');
    const requested = parseInt(searchParams.get('limit') || '50', 10);
    const limit = Math.min(Math.max(Number.isFinite(requested) ? requested : 50, 1), 500);

    const db = getCompatDb();
    let query = db.collection(COLLECTION).orderBy('createdAt', 'desc').limit(limit);
    if (eventType) {
      query = db.collection(COLLECTION).where('eventType', '==', eventType).orderBy('createdAt', 'desc').limit(limit);
    }
    if (domain) {
      query = db.collection(COLLECTION).where('domain', '==', domain).orderBy('createdAt', 'desc').limit(limit);
    }

    const snapshot = await query.get();
    const events: any[] = [];
    snapshot.forEach((doc) => events.push({ id: doc.id, ...doc.data() }));

    return NextResponse.json({ events, count: events.length });
  } catch (err: any) {
    return NextResponse.json({ events: [], error: err.message }, { status: 500 });
  }
}
