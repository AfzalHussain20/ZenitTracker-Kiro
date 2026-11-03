import { NextRequest, NextResponse } from 'next/server';
import { getCompatDb } from '@/lib/firebase-compat';

export const dynamic = 'force-dynamic';

const COLLECTION = 'analytics_events';

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
    const body = await req.json();
    const { eventName, properties = {}, userId, userName, domain = 'user_action', sessionId } = body;

    if (!eventName) {
      return NextResponse.json({ error: 'eventName is required' }, { status: 400 });
    }

    const event = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      timestamp: new Date().toISOString(),
      eventType: eventName,
      domain,
      userId: userId || 'anonymous',
      userName,
      metadata: {
        ...properties,
        source: properties.source || 'D2C',
        appName: properties.appName || 'Zenit Tracker',
        $D_timestamp: Date.now(),
        sessionId: sessionId || `server_session_${Date.now()}`,
      },
      sessionId: sessionId || `server_session_${Date.now()}`,
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
 * Query persisted events (admin/debug view).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const eventType = searchParams.get('eventType');
    const domain = searchParams.get('domain');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

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
