/**
 * Firebase compatibility layer for Cloudflare Workers
 * 
 * Uses Firebase v10 modular SDK but wraps it in a v8-compat-style proxy
 * so existing code that calls `db.collection('x').doc('y').get()` keeps working.
 * 
 * This is synchronous (no async initialization) because Workers can't do lazy
 * async initialization in module scope — each route handler must await nothing.
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  type Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  deleteField,
  type Query,
  type CollectionReference,
  type DocumentReference,
  type QueryConstraint,
} from 'firebase/firestore/lite';

// ─── Initialize Firebase once ─────────────────────────────────────────────────
function getFirebaseApp(): FirebaseApp {
  const apps = getApps();
  if (apps.length > 0) return apps[0];

  // These are public identifiers (not secrets) with fallbacks matching
  // src/lib/firebaseConfig.ts, so the server bundle keeps working even when the
  // NEXT_PUBLIC_* vars were not present at build time (e.g. CI build).
  return initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyARGoyDl7VRkePFnSzqUOvNNC_4oVs1mcA',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'zenit-tracker.firebaseapp.com',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'zenit-tracker',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'zenit-tracker.firebasestorage.app',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '23122688447',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:23122688447:web:64de75a5bf8345f5e1090a',
  });
}

// ─── Compat wrapper types ─────────────────────────────────────────────────────

type WhereFilterOp = '<' | '<=' | '==' | '!=' | '>=' | '>' | 'array-contains' | 'in' | 'not-in' | 'array-contains-any';

interface CompatDocSnapshot {
  id: string;
  exists: boolean;
  ref: CompatDocRef;
  data(): Record<string, any> | undefined;
  get(field: string): any;
}

interface CompatQuerySnapshot {
  empty: boolean;
  size: number;
  docs: CompatDocSnapshot[];
  forEach(cb: (snap: CompatDocSnapshot) => void): void;
}

interface CompatDocRef {
  id: string;
  path: string;
  collection(subPath: string): CompatCollectionRef;
  get(): Promise<CompatDocSnapshot>;
  set(data: Record<string, any>, options?: { merge?: boolean }): Promise<void>;
  update(data: Record<string, any>): Promise<void>;
  delete(): Promise<void>;
}

interface CompatQuery {
  where(field: string, op: WhereFilterOp, value: any): CompatQuery;
  orderBy(field: string, direction?: 'asc' | 'desc'): CompatQuery;
  limit(n: number): CompatQuery;
  get(): Promise<CompatQuerySnapshot>;
}

interface CompatCollectionRef extends CompatQuery {
  id: string;
  path: string;
  doc(id?: string): CompatDocRef;
  add(data: Record<string, any>): Promise<CompatDocRef>;
}

interface CompatBatch {
  set(ref: CompatDocRef, data: Record<string, any>): CompatBatch;
  update(ref: CompatDocRef, data: Record<string, any>): CompatBatch;
  delete(ref: CompatDocRef): CompatBatch;
  commit(): Promise<void>;
}

interface CompatDb {
  collection(path: string): CompatCollectionRef;
  batch(): CompatBatch;
  _native: Firestore;
}

// ─── Build document snapshot ──────────────────────────────────────────────────
function wrapDocSnap(snap: any, docRef: CompatDocRef): CompatDocSnapshot {
  return {
    id: snap.id,
    exists: snap.exists(),
    ref: docRef,
    data() {
      return snap.exists() ? snap.data() : undefined;
    },
    get(field: string) {
      return snap.exists() ? snap.data()?.[field] : undefined;
    },
  };
}

// ─── Build query snapshot ─────────────────────────────────────────────────────
function wrapQuerySnap(snap: any, db: Firestore): CompatQuerySnapshot {
  const docs: CompatDocSnapshot[] = snap.docs.map((d: any) => {
    const ref = buildDocRef(db, d.ref.path);
    return wrapDocSnap(d, ref);
  });
  return {
    empty: snap.empty,
    size: snap.size,
    docs,
    forEach(cb) { docs.forEach(cb); },
  };
}

// ─── Build query wrapper ──────────────────────────────────────────────────────
function buildQuery(fsDb: Firestore, baseRef: Query | CollectionReference, constraints: QueryConstraint[] = []): CompatQuery {
  const self: CompatQuery = {
    where(field, op, value) {
      return buildQuery(fsDb, baseRef, [...constraints, where(field, op as any, value)]);
    },
    orderBy(field, dir = 'asc') {
      return buildQuery(fsDb, baseRef, [...constraints, orderBy(field, dir)]);
    },
    limit(n) {
      return buildQuery(fsDb, baseRef, [...constraints, limit(n)]);
    },
    async get() {
      const q = constraints.length > 0 ? query(baseRef, ...constraints) : (baseRef as Query);
      const snap = await getDocs(q);
      return wrapQuerySnap(snap, fsDb);
    },
  };
  return self;
}

// ─── Build document reference ─────────────────────────────────────────────────
function buildDocRef(fsDb: Firestore, path: string): CompatDocRef {
  const fsRef: DocumentReference = doc(fsDb, path);
  const self: CompatDocRef = {
    id: fsRef.id,
    path: fsRef.path,
    collection(subPath) {
      return buildCollectionRef(fsDb, `${path}/${subPath}`);
    },
    async get() {
      const snap = await getDoc(fsRef);
      return wrapDocSnap(snap, self);
    },
    async set(data, opts) {
      if (opts?.merge) {
        await setDoc(fsRef, data, { merge: true });
      } else {
        await setDoc(fsRef, data);
      }
    },
    async update(data) {
      await updateDoc(fsRef, data);
    },
    async delete() {
      await deleteDoc(fsRef);
    },
  };
  return self;
}

// ─── Build collection reference ───────────────────────────────────────────────
function buildCollectionRef(fsDb: Firestore, path: string): CompatCollectionRef {
  const fsColRef: CollectionReference = collection(fsDb, path);
  const baseQuery = buildQuery(fsDb, fsColRef);

  const self: CompatCollectionRef = {
    id: fsColRef.id,
    path: fsColRef.path,
    where: baseQuery.where.bind(baseQuery),
    orderBy: baseQuery.orderBy.bind(baseQuery),
    limit: baseQuery.limit.bind(baseQuery),
    get: baseQuery.get.bind(baseQuery),
    doc(id?: string) {
      const docPath = id ? `${path}/${id}` : `${path}/${doc(fsDb, path).id}`;
      return buildDocRef(fsDb, docPath);
    },
    async add(data) {
      const ref = await addDoc(fsColRef, data);
      return buildDocRef(fsDb, ref.path);
    },
  };
  return self;
}

// ─── Build batch ──────────────────────────────────────────────────────────────
function buildBatch(fsDb: Firestore): CompatBatch {
  // Use array of operations since WriteBatch from v10 works the same way
  const ops: Array<{ type: 'set' | 'update' | 'delete'; ref: any; data?: any }> = [];

  const self: CompatBatch = {
    set(ref, data) {
      ops.push({ type: 'set', ref, data });
      return self;
    },
    update(ref, data) {
      ops.push({ type: 'update', ref, data });
      return self;
    },
    delete(ref) {
      ops.push({ type: 'delete', ref });
      return self;
    },
    async commit() {
      // Execute all ops sequentially (Cloudflare Workers supports this fine)
      for (const op of ops) {
        const fsDocRef = doc(fsDb, op.ref.path);
        if (op.type === 'set') await setDoc(fsDocRef, op.data);
        else if (op.type === 'update') await updateDoc(fsDocRef, op.data);
        else if (op.type === 'delete') await deleteDoc(fsDocRef);
      }
    },
  };
  return self;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns a synchronous v8-compat Firestore db wrapper.
 * Call this without `await` — it's synchronous.
 * 
 * Usage (unchanged from Firebase Admin SDK pattern):
 *   const db = getCompatDb();
 *   const snap = await db.collection('things').doc('id').get();
 */
export function getCompatDb(): CompatDb {
  const fsDb = getFirestore(getFirebaseApp());

  return {
    _native: fsDb,
    collection(path) {
      return buildCollectionRef(fsDb, path);
    },
    batch() {
      return buildBatch(fsDb);
    },
  };
}

/**
 * @deprecated Use getCompatDb() directly.
 * Kept for backward compatibility with firebaseAdminConfig.ts callers.
 */
export async function initializeFirebaseAdmin() {
  const db = getCompatDb();
  return { db, auth: null };
}

// Re-export useful field value utilities
export { serverTimestamp, deleteField };
