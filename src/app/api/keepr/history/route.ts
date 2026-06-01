/**
 * Keepr History API — read-only, no auth required (public)
 *
 * GET /api/keepr/history
 *   ?deviceId=device_3          → history for one device
 *   ?accountId=712020:abc       → history for one person
 *   ?team=Android+Team          → history for a team
 *   ?from=2025-05-01&to=2025-05-31  → date range filter
 *   ?limit=100                  → max records (default 200)
 *
 * Returns: { records: HistoryRecord[], stats: { totalSessions, avgDurationHours, topUser, topDevice } }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

const HISTORY_COLLECTION = 'keepr_history';

export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl;
    const deviceId  = searchParams.get('deviceId')  ?? undefined;
    const accountId = searchParams.get('accountId') ?? undefined;
    const team      = searchParams.get('team')      ?? undefined;
    const from      = searchParams.get('from')      ?? undefined;
    const to        = searchParams.get('to')        ?? undefined;
    const limitN    = Math.min(parseInt(searchParams.get('limit') ?? '200', 10), 500);

    try {
        const db = getAdminDb();
        let q: FirebaseFirestore.Query = db.collection(HISTORY_COLLECTION);

        // Apply filters
        if (deviceId)  q = q.where('deviceId',  '==', deviceId);
        if (accountId) q = q.where('accountId', '==', accountId);
        if (team)      q = q.where('team',       '==', team);
        if (from)      q = q.where('checkedOutAt', '>=', from);
        if (to)        q = q.where('checkedOutAt', '<=', to + 'T23:59:59Z');

        q = q.orderBy('checkedOutAt', 'desc').limit(limitN);

        const snap = await q.get();
        const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // ── Compute summary stats ──────────────────────────────────────────
        const completed = records.filter((r: any) => r.durationHours != null);
        const totalSessions   = records.length;
        const avgDurationHours = completed.length
            ? parseFloat((completed.reduce((s: number, r: any) => s + (r.durationHours ?? 0), 0) / completed.length).toFixed(2))
            : 0;

        // Top user by session count
        const userCount: Record<string, number> = {};
        for (const r of records as any[]) {
            if (r.userName) userCount[r.userName] = (userCount[r.userName] ?? 0) + 1;
        }
        const topUser = Object.entries(userCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

        // Top device by session count
        const deviceCount: Record<string, number> = {};
        for (const r of records as any[]) {
            if (r.deviceName) deviceCount[r.deviceName] = (deviceCount[r.deviceName] ?? 0) + 1;
        }
        const topDevice = Object.entries(deviceCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

        return NextResponse.json({
            records,
            stats: { totalSessions, avgDurationHours, topUser, topDevice },
        });
    } catch (err: any) {
        console.error('[Keepr History] GET error:', err.message);
        return NextResponse.json({ records: [], stats: null, error: err.message }, { status: 500 });
    }
}
