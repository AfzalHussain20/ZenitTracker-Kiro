import { NextRequest, NextResponse } from 'next/server';
import { getCompatDb } from '@/lib/firebase-compat';

export const dynamic = 'force-dynamic';

const COLLECTION = 'clevertap_sessions';

/**
 * Phase 6: CleverTap validation session persistence.
 * Saves validation sessions to Firestore for team visibility and historical tracking.
 */

export interface ValidationSessionData {
  id?: string;
  userId: string;
  userName: string;
  platform: string;
  appVersion: string;
  environment: string;
  events: {
    eventName: string;
    status: 'pass' | 'fail' | 'pending' | 'skipped';
    score: number;
    validatedAt?: number;
    fields?: { attr: string; status: string; expected?: string; actual?: string }[];
  }[];
  coverageMatrix: {
    eventName: string;
    platforms: Record<string, 'validated' | 'pending' | 'failed' | 'not_applicable'>;
  }[];
  summary: {
    totalEvents: number;
    validated: number;
    passed: number;
    failed: number;
    pending: number;
    overallScore: number;
  };
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  status: 'in_progress' | 'completed' | 'abandoned';
}

/**
 * POST: Save or update a validation session.
 */
export async function POST(req: NextRequest) {
  try {
    const body: ValidationSessionData = await req.json();

    if (!body.userId || !body.platform) {
      return NextResponse.json({ error: 'userId and platform are required' }, { status: 400 });
    }

    const db = getCompatDb();
    const now = Date.now();

    if (body.id) {
      // Update existing session
      const docRef = db.collection(COLLECTION).doc(body.id);
      await docRef.update({
        ...body,
        updatedAt: now,
      });
      return NextResponse.json({ id: body.id, updated: true });
    } else {
      // Create new session
      const sessionData = {
        ...body,
        createdAt: now,
        updatedAt: now,
        status: body.status || 'in_progress',
      };
      const docRef = await db.collection(COLLECTION).add(sessionData);
      return NextResponse.json({ id: docRef.id, created: true });
    }
  } catch (err: any) {
    console.error('[clevertap/sessions] POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * GET: Fetch validation sessions (optionally filtered by userId or platform).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const platform = searchParams.get('platform');
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const db = getCompatDb();
    let query = db.collection(COLLECTION).orderBy('updatedAt', 'desc').limit(limit);

    if (userId) {
      query = db.collection(COLLECTION).where('userId', '==', userId).orderBy('updatedAt', 'desc').limit(limit);
    }

    const snapshot = await query.get();
    const sessions: (ValidationSessionData & { id: string })[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data() as ValidationSessionData;
      sessions.push({ ...data, id: doc.id });
    });

    // Filter by platform in-memory if needed (Firestore doesn't allow multiple where + orderBy easily)
    const filtered = platform
      ? sessions.filter(s => s.platform === platform)
      : sessions;

    return NextResponse.json({ sessions: filtered });
  } catch (err: any) {
    console.error('[clevertap/sessions] GET error:', err.message);
    return NextResponse.json({ sessions: [], error: err.message });
  }
}
