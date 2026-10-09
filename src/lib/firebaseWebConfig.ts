/**
 * Firebase Web SDK configuration for Cloudflare Workers compatibility
 * This replaces the Firebase Admin SDK which is incompatible with Workers runtime
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { 
  getFirestore, 
  type Firestore,
  connectFirestoreEmulator,
  serverTimestamp,
  FieldValue as WebFieldValue
} from 'firebase/firestore';
import { 
  getAuth, 
  signInWithCustomToken,
  type Auth 
} from 'firebase/auth';

// Firebase configuration - these should be public (they're client-side safe)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp;
let db: Firestore;
let auth: Auth;

/**
 * Initialize Firebase Web SDK app
 */
export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    // Check if app already exists
    const existingApps = getApps();
    app = existingApps.length > 0 ? existingApps[0] : initializeApp(firebaseConfig);
  }
  return app;
}

/**
 * Get Firestore instance
 */
export function getFirebaseDb(): Firestore {
  if (!db) {
    const app = getFirebaseApp();
    db = getFirestore(app);
  }
  return db;
}

/**
 * Get Auth instance  
 */
export function getFirebaseAuth(): Auth {
  if (!auth) {
    const app = getFirebaseApp();
    auth = getAuth(app);
  }
  return auth;
}

/**
 * Compatibility wrapper that mimics Firebase Admin SDK structure
 * This allows existing code to work with minimal changes
 */
export async function getAdminDb(): Promise<Firestore> {
  return getFirebaseDb();
}

/**
 * Server-side authentication using service account
 * For Cloudflare Workers, we'll use a different approach than Admin SDK
 */
export async function authenticateServiceAccount(): Promise<Auth> {
  const auth = getFirebaseAuth();
  
  // In Cloudflare Workers, we can't use the Admin SDK's service account approach
  // Instead, we'll use the Web SDK with a custom token approach if needed
  // For now, return the auth instance - actual authentication will depend on use case
  
  return auth;
}

/**
 * Export field value helpers that match Admin SDK interface
 */
export const FieldValue = {
  serverTimestamp: () => serverTimestamp(),
  arrayUnion: WebFieldValue.arrayUnion,
  arrayRemove: WebFieldValue.arrayRemove,
  increment: WebFieldValue.increment,
  delete: WebFieldValue.delete,
};

/**
 * Export types for compatibility
 */
export type { Firestore, Auth };