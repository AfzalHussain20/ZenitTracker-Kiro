
import { initializeApp, getApps, getApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from "firebase/storage";

// Firebase public config — safe to include in client code.
// These are public identifiers, not secrets. The real security is Firestore rules.
// Values from environment variables with hardcoded fallbacks for deployments
// where NEXT_PUBLIC_* vars were not available at build time.
const firebaseConfig: FirebaseOptions = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyARGoyDl7VRkePFnSzqUOvNNC_4oVs1mcA',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'zenit-tracker.firebaseapp.com',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'zenit-tracker',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'zenit-tracker.firebasestorage.app',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '23122688447',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:23122688447:web:64de75a5bf8345f5e1090a',
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
} catch (error) {
    console.error("Firebase initialization failed:", error);
}

// @ts-ignore
export { app, auth, db, storage };
