/**
 * Test Runs API
 * GET  — List runs (optionally filtered by planId)
 * POST — Create a new run from a plan (copies all cases into the run)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

const RUNS_COLLECTION = 'test_runs';
const CASES_COLLECTION = 'test_cases';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const planId = searchParams.get('planId');
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200);

    try {
        const db = getAdminDb();
        let q: FirebaseFirestore.Query = db.collection(RUNS_COLLECTION).orderBy('startedAt', 'desc').limit(limit);
        if (planId) q = q.where('planId', '==', planId);

        const snap = await q.get();
        const runs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return NextResponse.json({ runs });
    } catch (err: any) {
        return NextResponse.json({ runs: [], error: err.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { planId, planTitle, startedBy, startedByUid } = body;

    if (!planId || !planTitle || !startedBy) {
        return NextResponse.json({ error: 'Missing planId, planTitle, or startedBy' }, { status: 400 });
    }

    try {
        const db = getAdminDb();
        const serverNow = new Date().toISOString();

        // Fetch all cases for this plan
        const casesSnap = await db.collection(CASES_COLLECTION).where('planId', '==', planId).get();
        const cases = casesSnap.docs.map(d => ({
            caseId: d.id,
            title: d.data().title ?? '',
            steps: d.data().steps ?? '',
            expectedResult: d.data().expectedResult ?? '',
            priority: d.data().priority ?? 'P1',
            // execution fields
            result: 'not_run' as const,
            actualResult: '',
            notes: '',
            executedAt: null as string | null,
        }));

        const runData = {
            planId,
            planTitle,
            startedBy,
            startedByUid: startedByUid ?? '',
            startedAt: serverNow,
            completedAt: null,
            status: 'in_progress' as const,
            cases,
            summary: {
                total: cases.length,
                passed: 0,
                failed: 0,
                blocked: 0,
                skipped: 0,
                not_run: cases.length,
            },
        };

        const ref = await db.collection(RUNS_COLLECTION).add(runData);
        return NextResponse.json({ success: true, runId: ref.id, run: { id: ref.id, ...runData } });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
