/**
 * Service-account Firestore adapter (REST).
 *
 * `firebase-compat` used the browser SDK without signing in, so every server
 * write/read was evaluated by security rules as an anonymous caller and failed
 * with "Missing or insufficient permissions". That silently broke onboarding,
 * billing activation, notes, Keepr persistence and analytics.
 *
 * This adapter keeps the same v8-style surface but talks to the Firestore REST
 * API as the service account, which bypasses rules (as the Admin SDK would).
 * It is intentionally small: it covers the subset of operations the API routes
 * actually use.
 */
import {
  getServiceAccountToken,
  decodeFirestoreFields,
  decodeFirestoreValue,
} from './firestore-rest';
import type {
  CompatBatch,
  CompatCollectionRef,
  CompatDb,
  CompatDocRef,
  CompatDocSnapshot,
  CompatQuery,
  CompatQuerySnapshot,
} from '@/lib/firebase-compat';

type Constraint =
  | { type: 'where'; field: string; op: string; value: any }
  | { type: 'orderBy'; field: string; direction: 'asc' | 'desc' }
  | { type: 'limit'; value: number };

const OP_MAP: Record<string, string> = {
  '==': 'EQUAL',
  '!=': 'NOT_EQUAL',
  '<': 'LESS_THAN',
  '<=': 'LESS_THAN_OR_EQUAL',
  '>': 'GREATER_THAN',
  '>=': 'GREATER_THAN_OR_EQUAL',
  'array-contains': 'ARRAY_CONTAINS',
  'in': 'IN',
  'not-in': 'NOT_IN',
  'array-contains-any': 'ARRAY_CONTAINS_ANY',
};

export function hasAdminCredentials(): boolean {
  return Boolean(
    process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY &&
      process.env.FIREBASE_PRIVATE_KEY.length > 20,
  );
}

function projectId(): string {
  return (
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    'zenit-tracker'
  );
}

function documentsBase(): string {
  return `https://firestore.googleapis.com/v1/projects/${projectId()}/databases/(default)/documents`;
}

async function adminFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await getServiceAccountToken();
  if (!token) throw new Error('Service account credentials are not configured');
  return fetch(url, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });
}

async function assertOk(res: Response, action: string): Promise<any> {
  if (res.ok) {
    if (res.status === 204) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }
  const text = await res.text();
  let message = text.slice(0, 300);
  try {
    message = JSON.parse(text)?.error?.message || message;
  } catch {
    // keep raw text
  }
  throw new Error(`${action} failed (${res.status}): ${message}`);
}

function isDeleteField(value: any): boolean {
  return value && typeof value === 'object' && value._methodName === 'deleteField';
}

function isServerTimestamp(value: any): boolean {
  return value && typeof value === 'object' && value._methodName === 'serverTimestamp';
}

function isFirestoreTimestamp(value: any): boolean {
  return (
    value &&
    typeof value === 'object' &&
    typeof value.seconds === 'number' &&
    typeof value.nanoseconds === 'number'
  );
}

function encodeValue(value: any): any {
  if (value === null || value === undefined) return { nullValue: null };
  if (isServerTimestamp(value)) return { timestampValue: new Date().toISOString() };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (isFirestoreTimestamp(value)) {
    return { timestampValue: new Date(value.seconds * 1000).toISOString() };
  }
  if (typeof value?.toDate === 'function') {
    try {
      return { timestampValue: value.toDate().toISOString() };
    } catch {
      // fall through
    }
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(encodeValue) } };
  }
  if (typeof value === 'object') {
    return { mapValue: { fields: encodeFields(value) } };
  }
  return { nullValue: null };
}

function encodeFields(data: Record<string, any>): Record<string, any> {
  const fields: Record<string, any> = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (isDeleteField(value)) continue;
    fields[key] = encodeValue(value);
  }
  return fields;
}

function randomId(): string {
  const uuid = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return uuid.replace(/-/g, '').slice(0, 20);
}

function docSnapshot(
  path: string,
  data: Record<string, any> | null,
  ref: CompatDocRef,
): CompatDocSnapshot {
  const exists = data !== null;
  return {
    id: path.split('/').pop() || '',
    exists,
    ref,
    data() {
      return exists ? data! : undefined;
    },
    get(field: string) {
      return exists ? data![field] : undefined;
    },
  };
}

async function getDoc(path: string): Promise<Record<string, any> | null> {
  const res = await adminFetch(`${documentsBase()}/${path}`);
  if (res.status === 404) return null;
  const json = await assertOk(res, 'Firestore read');
  return decodeFirestoreFields(json?.fields || {});
}

async function setDoc(
  path: string,
  data: Record<string, any>,
  merge: boolean,
): Promise<void> {
  const fields = encodeFields(data);
  const newKeys = Object.keys(fields);
  const deleteKeys = Object.keys(data).filter(key => isDeleteField(data[key]));

  // Firestore REST PATCH without an update mask *replaces* the whole document.
  // Merge writes therefore always need an explicit mask of the fields we send
  // (plus any fields being deleted); replace writes intentionally omit it.
  const params = new URLSearchParams();
  if (merge) {
    const maskKeys = Array.from(new Set([...newKeys, ...deleteKeys]));
    if (maskKeys.length === 0) return;
    for (const key of maskKeys) params.append('updateMask.fieldPaths', key);
  }
  const query = params.toString() ? `?${params.toString()}` : '';

  const res = await adminFetch(`${documentsBase()}/${path}${query}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  await assertOk(res, 'Firestore write');
}

async function updateDoc(path: string, data: Record<string, any>): Promise<void> {
  const fields = encodeFields(data);
  // Include deleteField keys in the mask (but not in `fields`) so Firestore
  // removes them.
  const maskKeys = Object.keys(data);
  if (maskKeys.length === 0) return;
  const params = new URLSearchParams();
  for (const key of maskKeys) params.append('updateMask.fieldPaths', key);
  const res = await adminFetch(`${documentsBase()}/${path}?${params.toString()}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  await assertOk(res, 'Firestore update');
}

async function deleteDoc(path: string): Promise<void> {
  const res = await adminFetch(`${documentsBase()}/${path}`, { method: 'DELETE' });
  if (res.status === 404) return;
  await assertOk(res, 'Firestore delete');
}

async function addDoc(
  collectionPath: string,
  data: Record<string, any>,
): Promise<string> {
  const res = await adminFetch(`${documentsBase()}/${collectionPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: encodeFields(data) }),
  });
  const json = await assertOk(res, 'Firestore create');
  const name: string = json?.name || '';
  return name.split('/').pop() || '';
}

function buildWhere(constraints: Constraint[]): any | undefined {
  const filters = constraints
    .filter((c): c is Extract<Constraint, { type: 'where' }> => c.type === 'where')
    .map(c => ({
      fieldFilter: {
        field: { fieldPath: c.field },
        op: OP_MAP[c.op] || 'EQUAL',
        value: encodeValue(c.value),
      },
    }));
  if (filters.length === 0) return undefined;
  if (filters.length === 1) return filters[0];
  return { compositeFilter: { op: 'AND', filters } };
}

async function runQuery(
  collectionPath: string,
  constraints: Constraint[],
): Promise<CompatQuerySnapshot> {
  const segments = collectionPath.split('/').filter(Boolean);
  const collectionId = segments.pop() || collectionPath;
  const parent = segments.join('/');

  const where = buildWhere(constraints);
  const orderBy = constraints
    .filter((c): c is Extract<Constraint, { type: 'orderBy' }> => c.type === 'orderBy')
    .map(c => ({
      field: { fieldPath: c.field },
      direction: c.direction === 'desc' ? 'DESCENDING' : 'ASCENDING',
    }));
  const limitConstraint = constraints.find(
    (c): c is Extract<Constraint, { type: 'limit' }> => c.type === 'limit',
  );

  const structuredQuery: Record<string, any> = {
    from: [{ collectionId }],
  };
  if (where) structuredQuery.where = where;
  if (orderBy.length) structuredQuery.orderBy = orderBy;
  if (limitConstraint) structuredQuery.limit = limitConstraint.value;

  const url = parent
    ? `${documentsBase()}/${parent}:runQuery`
    : `${documentsBase()}:runQuery`;

  const res = await adminFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery }),
  });
  const json = await assertOk(res, 'Firestore query');
  const rows: any[] = Array.isArray(json) ? json : [];

  const docs: CompatDocSnapshot[] = [];
  for (const row of rows) {
    const document = row?.document;
    if (!document?.name) continue;
    const path = document.name.split('/documents/').pop() || '';
    const data = decodeFirestoreFields(document.fields || {});
    const ref = buildDocRef(path);
    docs.push(docSnapshot(path, data, ref));
  }

  return {
    empty: docs.length === 0,
    size: docs.length,
    docs,
    forEach(cb) {
      docs.forEach(cb);
    },
  };
}

function buildQuery(collectionPath: string, constraints: Constraint[] = []): CompatQuery {
  return {
    where(field, op, value) {
      return buildQuery(collectionPath, [...constraints, { type: 'where', field, op, value }]);
    },
    orderBy(field, direction = 'asc') {
      return buildQuery(collectionPath, [...constraints, { type: 'orderBy', field, direction }]);
    },
    limit(value) {
      return buildQuery(collectionPath, [...constraints, { type: 'limit', value }]);
    },
    get() {
      return runQuery(collectionPath, constraints);
    },
  };
}

function buildDocRef(path: string): CompatDocRef {
  const ref: CompatDocRef = {
    id: path.split('/').pop() || '',
    path,
    collection(subPath: string) {
      return buildCollectionRef(`${path}/${subPath}`);
    },
    async get() {
      const data = await getDoc(path);
      return docSnapshot(path, data, ref);
    },
    async set(data, options) {
      await setDoc(path, data, Boolean(options?.merge));
    },
    async update(data) {
      await updateDoc(path, data);
    },
    async delete() {
      await deleteDoc(path);
    },
  };
  return ref;
}

function buildCollectionRef(path: string): CompatCollectionRef {
  const base = buildQuery(path);
  return {
    id: path.split('/').pop() || '',
    path,
    where: base.where.bind(base),
    orderBy: base.orderBy.bind(base),
    limit: base.limit.bind(base),
    get: base.get.bind(base),
    doc(id?: string) {
      return buildDocRef(`${path}/${id || randomId()}`);
    },
    async add(data) {
      const id = await addDoc(path, data);
      return buildDocRef(`${path}/${id}`);
    },
  };
}

function buildBatch(): CompatBatch {
  const ops: Array<() => Promise<void>> = [];
  const batch: CompatBatch = {
    set(ref, data) {
      ops.push(() => ref.set(data));
      return batch;
    },
    update(ref, data) {
      ops.push(() => ref.update(data));
      return batch;
    },
    delete(ref) {
      ops.push(() => ref.delete());
      return batch;
    },
    async commit() {
      for (const op of ops) await op();
    },
  };
  return batch;
}

export function createAdminCompatDb(): CompatDb {
  return {
    collection(path) {
      return buildCollectionRef(path);
    },
    batch() {
      return buildBatch();
    },
    // The REST adapter has no modular Firestore instance. Callers that need
    // `_native` should use the compat query API instead.
    _native: undefined as any,
  };
}

export { decodeFirestoreValue };
