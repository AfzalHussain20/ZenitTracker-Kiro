import { NextResponse } from 'next/server';
import { fetchSessionById, fetchSuiteMatchingTotal, mergeSuiteResults } from '@/lib/server/firestore-rest';

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

    // Some legacy sessions store only results as a map keyed by case orderIndex,
    // with the case definitions living in a `testSuites` document. Recover the
    // definitions so the report can render titles/steps/expected results.
    const cases = session.testCases;
    if (cases && !Array.isArray(cases) && typeof cases === 'object') {
      const total = Number(session.summary?.total) || Object.keys(cases).length;
      let suite: Record<string, any> | null = null;
      try {
        suite = total ? await fetchSuiteMatchingTotal(total, session.platformDetails?.platformName) : null;
      } catch { /* enrichment is best-effort */ }
      session.testCases = mergeSuiteResults(suite?.testCases, cases);
    } else if (!Array.isArray(cases)) {
      session.testCases = [];
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
