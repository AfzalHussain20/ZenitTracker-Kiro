import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** GET /api/ai/investigations — returns investigation history index */
export async function GET(req: NextRequest) {
  try {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      return NextResponse.json({ investigations: [], error: 'Firestore not configured' });
    }

    const { initializeApp, getApps, cert } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');
    const appName = 'investigation-store';
    const existing = getApps().find(a => a.name === appName);
    const app = existing || initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId }, appName);
    const db = getFirestore(app);

    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '20', 10), 50);
    const snap = await db.collection('investigation_index')
      .orderBy('generatedAt', 'desc')
      .limit(limit)
      .get();

    const investigations: any[] = [];
    snap.forEach(doc => investigations.push({ id: doc.id, ...doc.data() }));

    return NextResponse.json({ investigations });
  } catch (err: any) {
    return NextResponse.json({ investigations: [], error: err.message });
  }
}
