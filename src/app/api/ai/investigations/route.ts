import { NextRequest, NextResponse } from 'next/server';
import { getCompatDb } from '@/lib/firebase-compat';

export const dynamic = 'force-dynamic';

/** GET /api/ai/investigations — returns investigation history index */
export async function GET(req: NextRequest) {
  try {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

    if (!projectId) {
      return NextResponse.json({ investigations: [], error: 'Firestore not configured' });
    }

    const db = getCompatDb();

    const limitParam = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '20', 10), 50);
    const snap = await db
      .collection('investigation_index')
      .orderBy('generatedAt', 'desc')
      .limit(limitParam)
      .get();

    const investigations: any[] = [];
    snap.forEach(doc => investigations.push({ id: doc.id, ...doc.data() }));

    return NextResponse.json({ investigations });
  } catch (err: any) {
    return NextResponse.json({ investigations: [], error: err.message });
  }
}
