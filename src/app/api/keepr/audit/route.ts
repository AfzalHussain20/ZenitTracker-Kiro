/**
 * Weekly Audit API
 * POST — Start/save a new audit
 * GET  — Get audit history
 *
 * Audit document schema (keepr_audits collection):
 *   id, auditedBy, auditedAt (ISO), location,
 *   results: Array<{ deviceId, deviceName, status: 'present'|'missing'|'reassigned', assignedTo?, notes? }>
 *   summary: { total, present, missing, reassigned }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCompatDb } from '@/lib/firebase-compat';

const AUDITS_COLLECTION  = 'keepr_audits';
const DEVICES_COLLECTION = 'keepr_devices';

// ─── GET — fetch audit history ────────────────────────────────────────────────
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') ?? '20', 10);

    try {
        const db = getCompatDb();
        const snap = await db.collection(AUDITS_COLLECTION)
            .orderBy('auditedAt', 'desc')
            .limit(limit)
            .get();

        const audits = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return NextResponse.json({ audits });
    } catch (err: any) {
        return NextResponse.json({ audits: [], error: err.message }, { status: 500 });
    }
}

// ─── POST — save audit results ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    const body = await req.json();
    const { auditedBy, results } = body;

    if (!auditedBy || !results || !Array.isArray(results)) {
        return NextResponse.json({ error: 'Missing auditedBy or results[]' }, { status: 400 });
    }

    const serverNow = new Date().toISOString();

    // Calculate summary
    const summary = {
        total: results.length,
        present: results.filter((r: any) => r.status === 'present').length,
        missing: results.filter((r: any) => r.status === 'missing').length,
        reassigned: results.filter((r: any) => r.status === 'reassigned').length,
    };

    try {
        const db = getCompatDb();

        // Save audit record
        const auditRef = await db.collection(AUDITS_COLLECTION).add({
            auditedBy,
            auditedAt: serverNow,
            results,
            summary,
            weekNumber: getWeekNumber(new Date()),
        });

        // Update device statuses based on audit findings
        const batch = db.batch();
        for (const result of results) {
            if (result.status === 'missing') {
                const ref = db.collection(DEVICES_COLLECTION).doc(result.deviceId);
                batch.update(ref, { status: 'missing', notes: `Marked missing in audit — ${serverNow.split('T')[0]}` });
            }
            if (result.status === 'reassigned' && result.assignedTo) {
                const ref = db.collection(DEVICES_COLLECTION).doc(result.deviceId);
                batch.update(ref, {
                    status: 'checked-out',
                    checkedOutBy: { name: result.assignedTo, uid: result.assignedTo.toLowerCase().replace(/\s+/g, '_') },
                    checkedOutAt: serverNow,
                    assignedTo: result.assignedTo,
                    notes: result.notes || `Reassigned during audit — ${serverNow.split('T')[0]}`,
                });
            }
        }
        await batch.commit();

        return NextResponse.json({
            success: true,
            auditId: auditRef.id,
            summary,
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Audit save failed' }, { status: 500 });
    }
}

// Helper: ISO week number
function getWeekNumber(d: Date): number {
    const oneJan = new Date(d.getFullYear(), 0, 1);
    const days = Math.floor((d.getTime() - oneJan.getTime()) / 86400000);
    return Math.ceil((days + oneJan.getDay() + 1) / 7);
}
