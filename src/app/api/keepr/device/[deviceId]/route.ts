/**
 * Public Keepr Device API - no auth required
 * Uses Firebase Admin SDK to bypass security rules
 * Single source of truth for device state - syncs with Keepr web page via Firestore
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

const COLLECTION = 'keepr_devices';

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
