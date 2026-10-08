/**
 * Single Test Run API
 * GET   — Get run details
 * PATCH — Update a case result within a run, or complete the run
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

const RUNS_COLLECTION = 'test_runs';

export async function GET(_req: NextRequest, { params }: { params: { runId: string } }) {
    const { runId } = params;
    try {
        const db = getAdminDb();
        const snap = await db.collection(RUNS_COLLECTION).doc(runId).get();
        if (!snap.exists) return NextResponse.json({ error: 'Run not found' }, { status: 404 });
        return NextResponse.json({ run: { id: snap.id, ...snap.data() } });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, { params }: { params: { runId: string } }) {
    const { runId } = params;
    const body = await req.json();

    try {
        const db = getAdminDb();
        const ref = db.collection(RUNS_COLLECTION).doc(runId);
        const snap = await ref.get();
        if (!snap.exists) return NextResponse.json({ error: 'Run not found' }, { status: 404 });

        const data = snap.data()!;
        const cases = data.cases as any[];
        const serverNow = new Date().toISOString();

        // Update a specific case result
        if (body.caseId && body.result) {
            const idx = cases.findIndex((c: any) => c.caseId === body.caseId);
            if (idx < 0) return NextResponse.json({ error: 'Case not found in run' }, { status: 404 });

            cases[idx].result = body.result;
            cases[idx].actualResult = body.actualResult ?? '';
            cases[idx].notes = body.notes ?? '';
            cases[idx].executedAt = serverNow;

            // Recalculate summary
            const summary = {
                total: cases.length,
                passed: cases.filter((c: any) => c.result === 'passed').length,
                failed: cases.filter((c: any) => c.result === 'failed').length,
                blocked: cases.filter((c: any) => c.result === 'blocked').length,
                skipped: cases.filter((c: any) => c.result === 'skipped').length,
                not_run: cases.filter((c: any) => c.result === 'not_run').length,
            };

            await ref.update({ cases, summary });
            return NextResponse.json({ success: true, summary });
        }

        // Complete the run
        if (body.action === 'complete') {
            const summary = {
                total: cases.length,
                passed: cases.filter((c: any) => c.result === 'passed').length,
                failed: cases.filter((c: any) => c.result === 'failed').length,
                blocked: cases.filter((c: any) => c.result === 'blocked').length,
                skipped: cases.filter((c: any) => c.result === 'skipped').length,
                not_run: cases.filter((c: any) => c.result === 'not_run').length,
            };
            await ref.update({ status: 'completed', completedAt: serverNow, summary });
            return NextResponse.json({ success: true, status: 'completed', summary });
        }

        return NextResponse.json({ error: 'Invalid PATCH body' }, { status: 400 });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
