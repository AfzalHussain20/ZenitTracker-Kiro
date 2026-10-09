/**
 * GET  /api/keepr/device/list  — Returns ALL devices from keepr_devices collection
 * POST /api/keepr/device/list  — Seeds/updates all devices from MASTER list (admin sync)
 *
 * No auth required — public endpoint.
 */
import { NextResponse } from 'next/server';
import { getCompatDb } from '@/lib/firebase-compat';

const COLLECTION = 'keepr_devices';

// Master device list — single source of truth for seeding
const MASTER_DEVICES = [
    // ── QA Team ──
    { id:'device_1',  name:'Oppo A78',               type:'phone',  status:'available',   location:'QA Team Device Rack', os:'Android 13', ram:'8GB',  network:'4G',   condition:'good',      totalCheckouts:12 },
    { id:'device_2',  name:'Moto g31',               type:'phone',  status:'available',   location:'QA Team Device Rack', os:'Android 11', ram:'4GB',  network:'4G',   condition:'fair',      totalCheckouts:8  },
    { id:'device_3',  name:'Galaxy M32 5G',          type:'phone',  status:'available',   location:'QA Team Device Rack', os:'Android 13', ram:'6GB',  network:'5G',   condition:'excellent', totalCheckouts:21 },
    { id:'device_4',  name:'Redmi Tab Pad',          type:'tablet', status:'available',   location:'QA Team Device Rack', os:'Android 13', ram:'4GB',  network:'WiFi', condition:'good',      totalCheckouts:5  },
    { id:'device_5',  name:'Fire TV 4K Stick',       type:'tv',     status:'available',   location:'QA Team Device Rack', os:'Fire OS 8',              network:'WiFi', condition:'excellent', totalCheckouts:3  },
    // ── iOS Team ──
    { id:'ios_1',     name:'iPhone 12',              type:'phone',  status:'available',   location:'iOS Team', os:'iOS 15', network:'5G',  condition:'good', assignedTo:'QA' },
    { id:'ios_2',     name:'iPhone XR',              type:'phone',  status:'checked-out', location:'iOS Team', os:'iOS 16', network:'4G',  condition:'good', assignedTo:'Prasanth', checkedOutBy:{name:'Prasanth',uid:'prasanth'} },
    { id:'ios_3',     name:'iPhone 8',               type:'phone',  status:'available',   location:'iOS Team', os:'iOS 15', network:'4G',  condition:'fair', assignedTo:'QA' },
    { id:'ios_4',     name:'iPhone 14 Pro',          type:'phone',  status:'checked-out', location:'iOS Team', os:'iOS 17', network:'5G',  condition:'excellent', assignedTo:'Mahendran', checkedOutBy:{name:'Mahendran',uid:'mahendran'} },
    { id:'ios_5',     name:'iPad Mini',              type:'tablet', status:'available',   location:'API Team', os:'iOS 16', network:'WiFi', condition:'good' },
    { id:'ios_6',     name:'iPhone 14',              type:'phone',  status:'available',   location:'iOS Team', os:'iOS 17', ram:'6GB', network:'5G', condition:'excellent', totalCheckouts:17 },
    { id:'ios_7',     name:'iPad Air 5',             type:'tablet', status:'maintenance', location:'iOS Team', os:'iOS 17', ram:'8GB', network:'WiFi', condition:'poor', notes:'Screen crack - sent for repair' },
    { id:'ios_tv_1',  name:'Apple TV 4K Box',        type:'tv',     status:'checked-out', location:'iOS Team', os:'tvOS 17', network:'WiFi', condition:'good', assignedTo:'Seeman', checkedOutBy:{name:'Seeman',uid:'seeman'} },
    { id:'ios_tv_2',  name:'HD Box',                 type:'tv',     status:'checked-out', location:'Sun Direct Team', network:'WiFi', condition:'good', assignedTo:'Prasanth', checkedOutBy:{name:'Prasanth',uid:'prasanth'} },
    // ── iOS Team Laptops ──
    { id:'mac_1',     name:'MacBook Pro (Elayaraja)', type:'laptop', status:'checked-out', location:'iOS Team', os:'macOS', ram:'16GB', condition:'good', assignedTo:'Elayaraja', checkedOutBy:{name:'Elayaraja',uid:'elayaraja'} },
    { id:'mac_2',     name:'MacBook Pro (Seeman)',    type:'laptop', status:'checked-out', location:'iOS Team', os:'macOS', ram:'16GB', condition:'good', assignedTo:'Seeman', checkedOutBy:{name:'Seeman',uid:'seeman'} },
    { id:'mac_3',     name:'MacBook Pro (Prasanth)',  type:'laptop', status:'checked-out', location:'iOS Team', os:'macOS', ram:'16GB', condition:'good', assignedTo:'Prasanth', checkedOutBy:{name:'Prasanth',uid:'prasanth'} },
    { id:'mac_4',     name:'MacBook Pro (Mahendran)', type:'laptop', status:'checked-out', location:'iOS Team', os:'macOS', ram:'16GB', condition:'good', assignedTo:'Mahendran', checkedOutBy:{name:'Mahendran',uid:'mahendran'} },
    { id:'mac_5',     name:'MacBook Pro (Vignesh)',   type:'laptop', status:'checked-out', location:'PM Desk', os:'macOS', ram:'16GB', condition:'good', assignedTo:'Vignesh (PM)', checkedOutBy:{name:'Vignesh',uid:'vignesh'} },
    // ── Android Team ──
    { id:'android_1', name:'Samsung Galaxy Tab S8',    type:'tablet', status:'available', location:'Android Team', os:'Android 14', ram:'8GB', network:'5G', condition:'excellent', totalCheckouts:14 },
    { id:'android_2', name:'Realme 11 Pro',            type:'phone',  status:'available', location:'Android Team', os:'Android 14', ram:'8GB', network:'5G', condition:'excellent' },
    { id:'android_3', name:'Samsung Galaxy S21 FE 5G', type:'phone',  status:'available', location:'Android Team', os:'Android 13', ram:'8GB', network:'5G', condition:'good' },
    { id:'android_4', name:'Samsung Galaxy Z Fold 5',  type:'phone',  status:'available', location:'Android Team', os:'Android 14', ram:'12GB', network:'5G', condition:'excellent', notes:'Foldable - handle with care' },
    { id:'android_5', name:'Oppo A78 5G (Android)',    type:'phone',  status:'available', location:'Android Team', os:'Android 13', ram:'8GB', network:'5G', condition:'good' },
    { id:'android_6', name:'Fire Stick 4K Max',        type:'tv',     status:'available', location:'Android Team', os:'Fire OS 8', network:'WiFi', condition:'excellent' },
    { id:'android_7', name:'JIO STB',                  type:'tv',     status:'available', location:'Android Team', network:'WiFi', condition:'good' },
    // ── Accessories ──
    { id:'acc_1',     name:'Device Charger (QA)',       type:'accessory', status:'available', location:'QA Team Device Rack', accessoryType:'Charger adaptor', quantity:3, quantityAvailable:3, condition:'good' },
    { id:'acc_2',     name:'Lightning Cable',           type:'accessory', status:'available', location:'iOS Team', accessoryType:'Lightning cable', quantity:2, quantityAvailable:1, condition:'fair', notes:'1 missing' },
    { id:'acc_3',     name:'Type-C Cable',              type:'accessory', status:'missing',   location:'iOS Team', accessoryType:'Type-C cable', quantity:3, quantityAvailable:0, notes:'All 3 missing' },
    { id:'acc_4',     name:'Type-B Cable',              type:'accessory', status:'missing',   location:'QA Team Device Rack', accessoryType:'Type-B cable', quantity:2, quantityAvailable:0, notes:'2 cables missing' },
    { id:'acc_5',     name:'Charger Adaptor (iOS)',     type:'accessory', status:'available', location:'iOS Team', accessoryType:'Charger adaptor', quantity:4, quantityAvailable:2 },
    { id:'acc_6',     name:'HDMI Cable (Apple TV)',     type:'accessory', status:'available', location:'iOS Team', accessoryType:'HDMI cable', quantity:1, quantityAvailable:1, linkedDeviceId:'ios_tv_1' },
    { id:'acc_7',     name:'HDMI Cable (HD Box)',       type:'accessory', status:'available', location:'Sun Direct Team', accessoryType:'HDMI cable', quantity:1, quantityAvailable:1, linkedDeviceId:'ios_tv_2' },
    { id:'acc_8',     name:'HDMI Cable (QA Rack)',      type:'accessory', status:'missing',   location:'QA Team Device Rack', accessoryType:'HDMI cable', quantity:2, quantityAvailable:0, notes:'2 HDMI missing' },
    { id:'acc_9',     name:'Power Cable (Apple TV)',    type:'accessory', status:'available', location:'iOS Team', accessoryType:'Power cable', quantity:1, quantityAvailable:1, linkedDeviceId:'ios_tv_1' },
    { id:'acc_10',    name:'Power Cable (HD Box)',      type:'accessory', status:'available', location:'Sun Direct Team', accessoryType:'Power cable', quantity:1, quantityAvailable:1, linkedDeviceId:'ios_tv_2' },
    { id:'acc_11',    name:'Power Cable (Fire TV QA)',  type:'accessory', status:'available', location:'QA Team Device Rack', accessoryType:'Power cable', quantity:1, quantityAvailable:1, linkedDeviceId:'device_5' },
    { id:'acc_12',    name:'HDMI Cable (Fire Stick 4K Max)', type:'accessory', status:'available', location:'Android Team', accessoryType:'HDMI cable', quantity:1, quantityAvailable:1, linkedDeviceId:'android_6' },
    { id:'acc_13',    name:'Power Cable (Fire Stick 4K Max)', type:'accessory', status:'available', location:'Android Team', accessoryType:'Power cable', quantity:1, quantityAvailable:1, linkedDeviceId:'android_6' },
    { id:'acc_14',    name:'HDMI Cable (JIO STB)',     type:'accessory', status:'available', location:'Android Team', accessoryType:'HDMI cable', quantity:1, quantityAvailable:1, linkedDeviceId:'android_7' },
    { id:'acc_15',    name:'Power Cable (JIO STB)',    type:'accessory', status:'available', location:'Android Team', accessoryType:'Power cable', quantity:1, quantityAvailable:1, linkedDeviceId:'android_7' },
];

export async function GET() {
    try {
        const db   = getCompatDb();
        const snap = await db.collection(COLLECTION).get();

        if (snap.empty) {
            // Seed all devices if collection completely empty
            const batch = db.batch();
            for (const d of MASTER_DEVICES) {
                batch.set(db.collection(COLLECTION).doc(d.id), d);
            }
            await batch.commit();
            return NextResponse.json({ devices: MASTER_DEVICES, seeded: true });
        }

        const devices = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        devices.sort((a: any, b: any) => (a.name ?? '').localeCompare(b.name ?? ''));
        return NextResponse.json({ devices });
    } catch (err: any) {
        console.error('[Keepr List] Error:', err.message);
        return NextResponse.json({ devices: MASTER_DEVICES });
    }
}

// POST — Admin sync: push all MASTER_DEVICES to Firestore (creates new ones, doesn't overwrite existing)
export async function POST() {
    try {
        const db = getCompatDb();
        const snap = await db.collection(COLLECTION).get();
        const existingIds = new Set(snap.docs.map(d => d.id));

        // Only add devices that don't exist yet (won't overwrite checkout status of existing ones)
        const newDevices = MASTER_DEVICES.filter(d => !existingIds.has(d.id));

        if (newDevices.length === 0) {
            return NextResponse.json({ message: 'All devices already exist', added: 0, total: snap.size });
        }

        const batch = db.batch();
        for (const d of newDevices) {
            batch.set(db.collection(COLLECTION).doc(d.id), d);
        }
        await batch.commit();

        return NextResponse.json({
            message: `Added ${newDevices.length} new devices`,
            added: newDevices.length,
            total: snap.size + newDevices.length,
            newDevices: newDevices.map(d => d.name),
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
