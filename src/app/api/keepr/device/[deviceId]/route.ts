/**
 * Public Keepr Device API - no auth required
 * Uses Firebase Admin SDK to bypass security rules
 * Single source of truth for device state - syncs with Keepr web page via Firestore
 *
 * History tracking:
 * Every checkout/checkin writes an immutable record to `keepr_history`.
 * The device doc is updated as before — no breaking changes.
 * History schema:
 *   { deviceId, deviceName, deviceType, action, userName, accountId, team,
 *     checkedOutAt, checkedInAt, durationHours, sessionId, timestamp }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

const COLLECTION = 'keepr_devices';
const HISTORY_COLLECTION = 'keepr_history';

// ── Write a history event ─────────────────────────────────────────────────────
async function writeHistory(
    db: FirebaseFirestore.Firestore,
    deviceId: string,
    deviceSnap: FirebaseFirestore.DocumentSnapshot,
    update: Record<string, any>,
) {
    try {
        const { FieldValue } = await import('firebase-admin/firestore');
        const deviceData = deviceSnap.data() ?? {};
        const now = new Date().toISOString();

        if (update.status === 'checked-out') {
            // ── Checkout event ──────────────────────────────────────────────
            const sessionId = `session_${deviceId}_${Date.now()}`;
            await db.collection(HISTORY_COLLECTION).add({
                sessionId,
                deviceId,
                deviceName:  deviceData.name  ?? deviceId,
                deviceType:  deviceData.type  ?? 'other',
                action:      'checkout',
                userName:    update.checkedOutBy?.name    ?? 'Unknown',
                accountId:   update.checkedOutBy?.accountId ?? '',
                team:        update.checkedOutBy?.team    ?? '',
                checkedOutAt: update.checkedOutAt ?? now,
                checkedInAt:  null,
                durationHours: null,
                timestamp:   FieldValue.serverTimestamp(),
            });
        } else if (update.status === 'available' && deviceData.status === 'checked-out') {
            // ── Checkin event — find the open session and close it ──────────
            const openSessions = await db.collection(HISTORY_COLLECTION)
                .where('deviceId', '==', deviceId)
                .where('action', '==', 'checkout')
                .where('checkedInAt', '==', null)
                .orderBy('checkedOutAt', 'desc')
                .limit(1)
                .get();

            const checkedOutAt = deviceData.checkedOutAt as string | undefined;
            const checkedInAt  = now;
            const durationHours = checkedOutAt
                ? parseFloat(((Date.now() - new Date(checkedOutAt).getTime()) / 3_600_000).toFixed(2))
                : null;

            if (!openSessions.empty) {
                // Update the existing checkout record with checkin time
                await openSessions.docs[0].ref.update({
                    checkedInAt,
                    durationHours,
                    action: 'checkin',
                });
            } else {
                // No open session found — write a standalone checkin record
                await db.collection(HISTORY_COLLECTION).add({
                    sessionId:    `session_${deviceId}_checkin_${Date.now()}`,
                    deviceId,
                    deviceName:   deviceData.name ?? deviceId,
                    deviceType:   deviceData.type ?? 'other',
                    action:       'checkin',
                    userName:     deviceData.checkedOutBy?.name    ?? 'Unknown',
                    accountId:    deviceData.checkedOutBy?.accountId ?? '',
                    team:         deviceData.checkedOutBy?.team    ?? '',
                    checkedOutAt: checkedOutAt ?? null,
                    checkedInAt,
                    durationHours,
                    timestamp:    FieldValue.serverTimestamp(),
                });
            }
        }
    } catch (err) {
        // History write failure must NEVER break the device update
        console.error('[Keepr] History write failed (non-fatal):', err);
    }
}

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

export async function GET(_req: NextRequest, { params }: { params: { deviceId: string } }) {
    const { deviceId } = params;
    try {
        const db = getAdminDb();
        const snap = await db.collection(COLLECTION).doc(deviceId).get();
        if (snap.exists) {
            return NextResponse.json({ device: { id: snap.id, ...snap.data() } });
        }
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

export async function PATCH(req: NextRequest, { params }: { params: { deviceId: string } }) {
    const { deviceId } = params;
    const update = await req.json();
    try {
        const db = getAdminDb();
        const docRef = db.collection(COLLECTION).doc(deviceId);
        const snap = await docRef.get();
        if (!snap.exists) {
            const seed = SEED[deviceId];
            if (seed) await docRef.set(seed);
        }

        // ── Write history BEFORE updating device (so we can read old state) ──
        const currentSnap = snap.exists ? snap : await docRef.get();
        await writeHistory(db, deviceId, currentSnap, update);

        const { FieldValue } = await import('firebase-admin/firestore');
        const fsUpdate: Record<string, any> = {};
        for (const [k, v] of Object.entries(update)) {
            fsUpdate[k] = v === null ? FieldValue.delete() : v;
        }
        await docRef.update(fsUpdate);
        const updated = await docRef.get();
        return NextResponse.json({ success: true, device: { id: updated.id, ...updated.data() } });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Update failed' }, { status: 500 });
    }
}

export async function POST(_req: NextRequest) {
    try {
        const db = getAdminDb();
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
