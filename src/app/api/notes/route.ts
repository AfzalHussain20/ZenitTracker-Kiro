import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

// GET /api/notes — list notes (with optional search/filter)
export async function GET(req: NextRequest) {
  try {
    const adminDb = getAdminDb();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const search = searchParams.get('search')?.toLowerCase();
    const category = searchParams.get('category');
    const tag = searchParams.get('tag');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    let query = adminDb.collection('zenit_notes')
      .where('userId', '==', userId)
      .where('archived', '==', false)
      .orderBy('updatedAt', 'desc')
      .limit(limit);

    if (category && category !== 'all') {
      query = adminDb.collection('zenit_notes')
        .where('userId', '==', userId)
        .where('archived', '==', false)
        .where('category', '==', category)
        .orderBy('updatedAt', 'desc')
        .limit(limit);
    }

    const snapshot = await query.get();
    let notes = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    }));

    // Client-side search filter (for full-text search on plainText)
    if (search) {
      notes = notes.filter((n: any) =>
        n.title?.toLowerCase().includes(search) ||
        n.plainText?.toLowerCase().includes(search) ||
        n.tags?.some((t: string) => t.toLowerCase().includes(search))
      );
    }

    if (tag) {
      notes = notes.filter((n: any) => n.tags?.includes(tag));
    }

    return NextResponse.json({ notes });
  } catch (error: any) {
    console.error('Notes GET error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch notes' }, { status: 500 });
  }
}

// POST /api/notes — create a new note
export async function POST(req: NextRequest) {
  try {
    const adminDb = getAdminDb();
    const body = await req.json();
    const { title, content, plainText, tags, userId, userName, category, linkedBugs, linkedSession, pinned } = body;

    if (!userId || !content) {
      return NextResponse.json({ error: 'userId and content required' }, { status: 400 });
    }

    const now = new Date();
    const noteData = {
      title: title || '',
      content,
      plainText: plainText || content.replace(/[#*`_~\[\]]/g, '').trim(),
      tags: tags || [],
      createdAt: now,
      updatedAt: now,
      userId,
      userName: userName || 'Unknown',
      pinned: pinned || false,
      archived: false,
      category: category || 'general',
      linkedBugs: linkedBugs || [],
      linkedSession: linkedSession || null,
    };

    const docRef = await adminDb.collection('zenit_notes').add(noteData);

    return NextResponse.json({
      id: docRef.id,
      ...noteData,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }, { status: 201 });
  } catch (error: any) {
    console.error('Notes POST error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create note' }, { status: 500 });
  }
}
