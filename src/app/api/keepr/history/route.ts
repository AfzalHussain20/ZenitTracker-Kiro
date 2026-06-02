/**
 * Keepr History API — read-only, no auth required
 *
 * GET /api/keepr/history
 *   ?deviceId=device_3
 *   ?accountId=712020:abc
 *   ?team=Android+Team
 *   ?from=2025-05-01&to=2025-05-31   (ISO date, inclusive)
 *   ?limit=200
 *
 * Each record includes:
 *   - who checked out (userName, team)
 *   - who/where it was returned to (returnedToName, returnLocation)
 *   - server-recorded checkedOutAt + checkedInAt (accurate, not client clock)
 *   - durationMs + durationHours (exact)
 *
 * Returns: { records[], stats{ totalSessions, avgDurationHours, avgDurationMin,
 *            totalHours, topUser, topDevice, returnBreakdown } }
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

        // Build the most selective query possible.
        // Firestore requires all equality filters before range filters.
        let q: FirebaseFirestore.Query = db.collection(HISTORY_COLLECTION);

        if (deviceId)  q = q.where('deviceId',  '==', deviceId);
        if (accountId) q = q.where('accountId', '==', accountId);
        if (team)      q = q.where('team',       '==', team);

        // Date range on checkedOutAt — only add if we have an index, otherwise filter client-side
        let useClientDateFilter = false;
        if (from || to) {
            try {
                if (from) q = q.where('checkedOutAt', '>=', from);
                if (to)   q = q.where('checkedOutAt', '<=', to + 'T23:59:59.999Z');
                q = q.orderBy('checkedOutAt', 'desc');
            } catch {
                // Index not ready — fall back to client-side date filtering
                useClientDateFilter = true;
            }
        } else {
            // No date filter — order by checkedOutAt if possible, else timestamp
            try {
                q = q.orderBy('checkedOutAt', 'desc');
            } catch {
                q = q.orderBy('timestamp', 'desc');
            }
        }

        q = q.limit(limitN);

        const snap = await q.get();
        let records: any[] = snap.docs.map(d => {
            const data = d.data();
            // Convert Firestore Timestamp to ISO string for timestamp field
            const ts = data.timestamp;
            return {
                id: d.id,
                ...data,
                timestamp: ts?.toDate ? ts.toDate().toISOString() : ts,
            };
        });

        // Client-side date filter fallback
        if (useClientDateFilter) {
            if (from) records = records.filter(r => r.checkedOutAt >= from);
            if (to)   records = records.filter(r => r.checkedOutAt <= to + 'T23:59:59.999Z');
            records.sort((a, b) => (b.checkedOutAt ?? '').localeCompare(a.checkedOutAt ?? ''));
        }

        // ── Stats ──────────────────────────────────────────────────────────
        const completed  = records.filter(r => r.durationHours != null && r.durationHours > 0);
        const totalSessions    = records.length;
        const totalHours       = parseFloat(completed.reduce((s, r) => s + (r.durationHours ?? 0), 0).toFixed(2));
        const avgDurationHours = completed.length
            ? parseFloat((totalHours / completed.length).toFixed(2))
            : 0;
        const avgDurationMin = Math.round(avgDurationHours * 60);

        // Longest session
        const longestSession = completed.length
            ? completed.reduce((max, r) => r.durationHours > max.durationHours ? r : max, completed[0])
            : null;

        // Top user by session count
        const userCount: Record<string, number> = {};
        for (const r of records) {
            if (r.userName) userCount[r.userName] = (userCount[r.userName] ?? 0) + 1;
        }
        const topUser = Object.entries(userCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

        // Top device by session count
        const deviceCount: Record<string, number> = {};
        for (const r of records) {
            if (r.deviceName) deviceCount[r.deviceName] = (deviceCount[r.deviceName] ?? 0) + 1;
        }
        const topDevice = Object.entries(deviceCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

        // Return destination breakdown
        const returnBreakdown = {
            toPerson:   records.filter(r => r.returnedToName).length,
            toLocation: records.filter(r => r.returnLocation && !r.returnedToName).length,
            unknown:    records.filter(r => !r.returnedToName && !r.returnLocation && r.checkedInAt).length,
            pending:    records.filter(r => !r.checkedInAt).length,
        };

        return NextResponse.json({
            records,
            stats: {
                totalSessions,
                totalHours,
                avgDurationHours,
                avgDurationMin,
                topUser,
                topDevice,
                longestSession: longestSession
                    ? { deviceName: longestSession.deviceName, userName: longestSession.userName, durationHours: longestSession.durationHours }
                    : null,
                returnBreakdown,
            },
        });
    } catch (err: any) {
        console.error('[Keepr History] GET error:', err.message);
        return NextResponse.json({ records: [], stats: null, error: err.message }, { status: 500 });
    }
}
