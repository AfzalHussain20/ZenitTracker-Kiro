/**
 * GET /api/keepr/device/list
 * Returns ALL devices from keepr_devices collection.
 * No auth required — public endpoint.
 * This replaces the hardcoded device_1..device_8 array in the scan page.
 */
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

const COLLECTION = 'keepr_devices';

const SEED_DEVICES = [
    { id:'device_1', name:'Oppo A78',              type:'phone',  status:'available',   location:'QA Team Device Rack', os:'Android 13', ram:'8GB',  network:'4G',   condition:'good',      totalCheckouts:12 },
    { id:'device_2', name:'Moto g31',              type:'phone',  status:'available',   location:'QA Team Device Rack', os:'Android 11', ram:'4GB',  network:'4G',   condition:'fair',      totalCheckouts:8  },
    { id:'device_3', name:'Galaxy M32 5G',         type:'phone',  status:'available',   location:'QA Team Device Rack', os:'Android 13', ram:'6GB',  network:'5G',   condition:'excellent', totalCheckouts:21 },
    { id:'device_4', name:'Redmi Tab Pad',         type:'tablet', status:'available',   location:'QA Team Device Rack', os:'Android 13', ram:'4GB',  network:'WiFi', condition:'good',      totalCheckouts:5  },
    { id:'device_5', name:'Fire TV 4K Stick',      type:'tv',     status:'available',   location:'QA Team Device Rack', os:'Fire OS 8',              network:'WiFi', condition:'excellent', totalCheckouts:3  },
    { id:'device_6', name:'iPhone 14',             type:'phone',  status:'available',   location:'iOS Team',            os:'iOS 17',     ram:'6GB',  network:'5G',   condition:'excellent', totalCheckouts:17 },
    { id:'device_7', name:'iPad Air 5',            type:'tablet', status:'maintenance', location:'iOS Team',            os:'iOS 17',     ram:'8GB',  network:'WiFi', condition:'poor',      totalCheckouts:9  },
    { id:'device_8', name:'Samsung Galaxy Tab S8', type:'tablet', status:'available',   location:'Android Team',        os:'Android 14', ram:'8GB',  network:'5G',   condition:'excellent', totalCheckouts:14 },
];

export async function GET() {
    try {
        const db   = getAdminDb();
        const snap = await db.collection(COLLECTION).get();

        if (snap.empty) {
            // Seed if collection empty
            const batch = db.batch();
            for (const d of SEED_DEVICES) {
                batch.set(db.collection(COLLECTION).doc(d.id), d);
            }
            await batch.commit();
            return NextResponse.json({ devices: SEED_DEVICES });
        }

        const devices = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Sort by name for consistent ordering
        devices.sort((a: any, b: any) => (a.name ?? '').localeCompare(b.name ?? ''));
        return NextResponse.json({ devices });
    } catch (err: any) {
        // Fallback to seed data if Firebase fails
        console.error('[Keepr List] Error:', err.message);
        return NextResponse.json({ devices: SEED_DEVICES });
    }
}
