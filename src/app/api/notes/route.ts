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
    const limit = parseInt(searchParams.get('limit') || '100');

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    // Simple query without composite index requirement
    // Fetch all user's non-archived notes, sort client-side
    const snapshot = await adminDb.collection('zenit_notes')
      .where('userId', '==', userId)
      .limit(limit)
      .get();

    let notes = snapshot.docs
      .map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt || new Date().toISOString(),
        };
      })
      // Filter out archived notes client-side (avoids composite index)
      .filter((n: any) => !n.archived)
      // Sort by createdAt descending (newest first)
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Category filter
    if (category && category !== 'all') {
      notes = notes.filter((n: any) => n.category === category);
    }

    // Search filter
    if (search) {
      notes = notes.filter((n: any) =>
        n.title?.toLowerCase().includes(search) ||
        n.plainText?.toLowerCase().includes(search) ||
        n.content?.toLowerCase().includes(search) ||
        n.tags?.some((t: string) => t.toLowerCase().includes(search))
      );
    }

    // Tag filter
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

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    // Allow saving even with empty content (for drafts)
    const now = new Date();
    const noteData = {
      title: title || '',
      content: content || '',
      plainText: plainText || (content || '').replace(/[#*`_~\[\]]/g, '').trim(),
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
