import { NextResponse } from 'next/server';
import { fetchSessionById } from '@/lib/server/firestore-rest';

export const dynamic = 'force-dynamic';

/**
 * Public, unauthenticated endpoint used by the shareable report page.
 *
 * Reads the session with the service account (bypassing Firestore security
 * rules) so guests with a link can view a report regardless of its status. The
 * session id is an unguessable Firestore document id.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params;
    const session = await fetchSessionById(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return NextResponse.json(
      { session },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: 'server_error', message: error?.message || 'Failed to load report' },
      { status: 500 },
    );
  }
}
