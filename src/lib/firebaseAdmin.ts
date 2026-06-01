/**
 * Firebase Admin SDK — server-side only
 * Bypasses Firestore security rules — used for public QR scan writes
 */
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

let adminApp: App | undefined;
let adminDb: Firestore | undefined;

function getAdminApp(): App {
    if (adminApp) return adminApp;

    const existingApps = getApps();
    if (existingApps.length > 0) {
        adminApp = existingApps[0];
        return adminApp;
    }

    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (projectId && clientEmail && privateKey) {
        adminApp = initializeApp({
            credential: cert({ projectId, clientEmail, privateKey }),
            projectId,
        });
    } else {
        // Fallback: initialize without credentials (works for emulator or if rules allow)
        adminApp = initializeApp({ projectId: projectId || 'zenit-tracker' });
    }

    return adminApp;
}

export function getAdminDb(): Firestore {
    if (adminDb) return adminDb;
    adminDb = getFirestore(getAdminApp());
    return adminDb;
}
