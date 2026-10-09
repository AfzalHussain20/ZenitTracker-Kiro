/**
 * Public Keepr Device API - no auth required
 * Uses Firebase Admin SDK to bypass security rules
 *
 * Time tracking — accurate approach:
 * - checkedOutAt is set server-side at the moment of PATCH, not trusted from client
 * - checkedInAt is set server-side at moment of return PATCH
 * - durationMs / durationHours calculated from server-recorded times only
 * - returnedTo (person) and returnLocation (rack/team) stored in history
 *
 * History schema (keepr_history collection):
 *   sessionId, deviceId, deviceName, deviceType,
 *   action (checkout|checkin),
 *   userName, accountId, team,           ← who checked it out
 *   returnedToName, returnedToAccountId, returnedToTeam,  ← who received it back
 *   returnLocation,                      ← rack/team name if returned to location
 *   checkedOutAt (ISO, server-set),
 *   checkedInAt  (ISO, server-set),
 *   durationMs, durationHours,           ← exact duration
 *   timestamp (Firestore serverTimestamp)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCompatDb } from '@/lib/firebase-compat';

const COLLECTION         = 'keepr_devices';
const HISTORY_COLLECTION = 'keepr_history';

// ─── Write history record ─────────────────────────────────────────────────────
async function writeHistory(
    db: FirebaseFirestore.Firestore,
    deviceId: string,
    deviceSnap: FirebaseFirestore.DocumentSnapshot,
    update: Record<string, any>,
    serverNow: string,   // ISO string set by server
) {
    try {
        // Use Firestore Web SDK compatible timestamp
        const { serverTimestamp } = await import('firebase/firestore');
        const d = deviceSnap.data() ?? {};

        if (update.status === 'checked-out') {
            // ── CHECKOUT: open a new session ──────────────────────────────
            const sessionId = `session_${deviceId}_${Date.now()}`;
            await db.collection(HISTORY_COLLECTION).add({
                sessionId,
                deviceId,
                deviceName:   d.name ?? deviceId,
                deviceType:   d.type ?? 'other',
                action:       'checkout',
                // Who is taking the device
                userName:     update.checkedOutBy?.name      ?? 'Unknown',
                accountId:    update.checkedOutBy?.accountId ?? '',
                team:         update.checkedOutBy?.team      ?? '',
                // Return fields — empty until checkin
                returnedToName:      null,
                returnedToAccountId: null,
                returnedToTeam:      null,
                returnLocation:      null,
                // Times — server-set, not client-set
                checkedOutAt:  serverNow,
                checkedInAt:   null,
                durationMs:    null,
                durationHours: null,
                timestamp:     serverTimestamp(),
            });

        } else if (update.status === 'available' && d.status === 'checked-out') {
            // ── CHECKIN: close the open session ───────────────────────────
            // Use the server-recorded checkedOutAt from the device doc
            const checkedOutAt: string | null = d.checkedOutAt ?? null;
            const durationMs = checkedOutAt
                ? Date.now() - new Date(checkedOutAt).getTime()
                : null;
            const durationHours = durationMs != null
                ? parseFloat((durationMs / 3_600_000).toFixed(4))
                : null;

            // Build return destination fields from the update payload
            const returnedToPerson   = update.returnedTo ?? null;   // { name, accountId, team }
            const returnedToLocation = update.returnLocation ?? null; // string e.g. "qa_rack"

            const checkinFields = {
                checkedInAt:         serverNow,
                durationMs:          durationMs ?? null,
                durationHours:       durationHours ?? null,
                action:              'checkin',
                returnedToName:      returnedToPerson?.name      ?? null,
                returnedToAccountId: returnedToPerson?.accountId ?? null,
                returnedToTeam:      returnedToPerson?.team      ?? null,
                returnLocation:      returnedToLocation,
            };

            // Try to find and update the open session
            try {
                const openSessions = await db.collection(HISTORY_COLLECTION)
                    .where('deviceId',    '==', deviceId)
                    .where('checkedInAt', '==', null)
                    .orderBy('checkedOutAt', 'desc')
                    .limit(1)
                    .get();

                if (!openSessions.empty) {
                    await openSessions.docs[0].ref.update(checkinFields);
                    return; // done
                }
            } catch {
                // Index may not exist yet — fall through to write standalone
            }

            // No open session found — write a complete standalone record
            await db.collection(HISTORY_COLLECTION).add({
                sessionId:    `session_${deviceId}_checkin_${Date.now()}`,
                deviceId,
                deviceName:   d.name ?? deviceId,
                deviceType:   d.type ?? 'other',
                userName:     d.checkedOutBy?.name      ?? 'Unknown',
                accountId:    d.checkedOutBy?.accountId ?? '',
                team:         d.checkedOutBy?.team      ?? '',
                checkedOutAt: checkedOutAt,
                ...checkinFields,
                timestamp:    serverTimestamp(),
            });
        }
    } catch (err) {
        // History write failure must NEVER break the device update
        console.error('[Keepr] History write failed (non-fatal):', err);
    }
}

// ─── Seed data ────────────────────────────────────────────────────────────────
const SEED: Record<string, any> = {
    'device_1': { id:'device_1', name:'Oppo A78',              type:'phone',  status:'available',   location:'QA Team Device Rack', os:'Android 13', ram:'8GB',  network:'4G',   condition:'good',      totalCheckouts:12 },
    'device_2': { id:'device_2', name:'Moto g31',              type:'phone',  status:'available',   location:'QA Team Device Rack', os:'Android 11', ram:'4GB',  network:'4G',   condition:'fair',      totalCheckouts:8  },
    'device_3': { id:'device_3', name:'Galaxy M32 5G',         type:'phone',  status:'available',   location:'QA Team Device Rack', os:'Android 13', ram:'6GB',  network:'5G',   condition:'excellent', totalCheckouts:21 },
    'device_4': { id:'device_4', name:'Redmi Tab Pad',         type:'tablet', status:'available',   location:'QA Team Device Rack', os:'Android 13', ram:'4GB',  network:'WiFi', condition:'good',      totalCheckouts:5  },
    'device_5': { id:'device_5', name:'Fire TV 4K Stick',      type:'tv',     status:'available',   location:'QA Team Device Rack', os:'Fire OS 8',              network:'WiFi', condition:'excellent', totalCheckouts:3  },
    'device_6': { id:'device_6', name:'iPhone 14',             type:'phone',  status:'available',   location:'iOS Team',            os:'iOS 17',     ram:'6GB',  network:'5G',   condition:'excellent', totalCheckouts:17 },
    'device_7': { id:'device_7', name:'iPad Air 5',            type:'tablet', status:'maintenance', location:'iOS Team',            os:'iOS 17',     ram:'8GB',  network:'WiFi', condition:'poor',      totalCheckouts:9,  notes:'Screen crack - sent for repair' },
    'device_8': { id:'device_8', name:'Samsung Galaxy Tab S8', type:'tablet', status:'available',   location:'Android Team',        os:'Android 14', ram:'8GB',  network:'5G',   condition:'excellent', totalCheckouts:14 },
};

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: { params: { deviceId: string } }) {
    const { deviceId } = params;
    try {
        const db = getCompatDb();
        const snap = await db.collection(COLLECTION).doc(deviceId).get();
        if (snap.exists) return NextResponse.json({ device: { id: snap.id, ...snap.data() } });
        const seed = SEED[deviceId];
        if (seed) {
            await db.collection(COLLECTION).doc(deviceId).set(seed);
            return NextResponse.json({ device: seed });
        }
        return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    } catch {
        const seed = SEED[deviceId];
        if (seed) return NextResponse.json({ device: seed });
        return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }
}

// ─── PATCH ────────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: { params: { deviceId: string } }) {
    const { deviceId } = params;
    const body = await req.json();

    // ── SERVER-SIDE TIME: ignore any timestamps from the client ──────────────
    const serverNow = new Date().toISOString();

    // Forcibly replace client-sent timestamps with server time
    if (body.status === 'checked-out') {
        body.checkedOutAt = serverNow;   // override — always server time
    }
    if (body.status === 'available') {
        body.lastCheckedIn = serverNow;  // override — always server time
        // CRITICAL: when returning to available, MUST null out checkedOutBy + checkedOutAt
        body.checkedOutBy = null;
        body.checkedOutAt = null;
    }

    try {
        const db = getCompatDb();
        const docRef = db.collection(COLLECTION).doc(deviceId);
        let   snap   = await docRef.get();

        if (!snap.exists) {
            const seed = SEED[deviceId];
            if (seed) { await docRef.set(seed); snap = await docRef.get(); }
        }

        // Write history BEFORE device update so we can read the old state (checkedOutAt etc.)
        await writeHistory(db, deviceId, snap, body, serverNow);

        // Apply update to device doc
        const { deleteField } = await import('firebase/firestore');
        const fsUpdate: Record<string, any> = {};
        for (const [k, v] of Object.entries(body)) {
            fsUpdate[k] = v === null ? deleteField() : v;
        }
        await docRef.update(fsUpdate);

        const updated = await docRef.get();
        return NextResponse.json({ success: true, device: { id: updated.id, ...updated.data() } });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Update failed' }, { status: 500 });
    }
}

// ─── POST (seed all devices) ──────────────────────────────────────────────────
export async function POST(_req: NextRequest) {
    try {
        const db = getCompatDb();
        const snap = await db.collection(COLLECTION).get();
        if (snap.empty) {
            const batch = db.batch();
            for (const [id, data] of Object.entries(SEED)) {
                batch.set(db.collection(COLLECTION).doc(id), data);
            }
            await batch.commit();
            return NextResponse.json({ devices: Object.values(SEED) });
        }
        return NextResponse.json({ devices: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    } catch {
        return NextResponse.json({ devices: Object.values(SEED) });
    }
}
