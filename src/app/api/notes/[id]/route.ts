import { NextRequest, NextResponse } from 'next/server';
import { getCompatDb } from '@/lib/firebase-compat';
import { getRequestUser, unauthorized, forbidden, isInternalEmail } from '@/lib/server/request-auth';

async function loadOwnedNote(id: string, uid: string, email: string) {
  const db = getCompatDb();
  const doc = await db.collection('zenit_notes').doc(id).get();
  if (!doc.exists) return { error: 'not_found' as const };
  const data = doc.data() || {};
  if (data.userId !== uid && !isInternalEmail(email)) return { error: 'forbidden' as const };
  return { doc, data };
}

// GET /api/notes/[id] — get single note
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getRequestUser(req);
    if (!user) return unauthorized();

    const { id } = await params;
    const result = await loadOwnedNote(id, user.uid, user.email);
    if (result.error === 'not_found') return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    if (result.error === 'forbidden') return forbidden();

    const data = result.data!;
    return NextResponse.json({
      id: result.doc!.id,
      ...data,
      createdAt: data?.createdAt?.toDate?.()?.toISOString() || data?.createdAt || new Date().toISOString(),
      updatedAt: data?.updatedAt?.toDate?.()?.toISOString() || data?.updatedAt || new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch note' }, { status: 500 });
  }
}

// PATCH /api/notes/[id] — update note
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getRequestUser(req);
    if (!user) return unauthorized();

    const { id } = await params;
    const result = await loadOwnedNote(id, user.uid, user.email);
    if (result.error === 'not_found') return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    if (result.error === 'forbidden') return forbidden();

    const body = await req.json();
    const { title, content, plainText, tags, category, pinned, archived, linkedBugs } = body;

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (plainText !== undefined) updateData.plainText = plainText;
    if (tags !== undefined) updateData.tags = tags;
    if (category !== undefined) updateData.category = category;
    if (pinned !== undefined) updateData.pinned = pinned;
    if (archived !== undefined) updateData.archived = archived;
    if (linkedBugs !== undefined) updateData.linkedBugs = linkedBugs;

    await getCompatDb().collection('zenit_notes').doc(id).update(updateData);

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update note' }, { status: 500 });
  }
}

// DELETE /api/notes/[id] — soft delete (archive)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getRequestUser(req);
    if (!user) return unauthorized();

    const { id } = await params;
    const result = await loadOwnedNote(id, user.uid, user.email);
    if (result.error === 'not_found') return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    if (result.error === 'forbidden') return forbidden();

    await getCompatDb().collection('zenit_notes').doc(id).update({
      archived: true,
      updatedAt: new Date(),
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete note' }, { status: 500 });
  }
}
