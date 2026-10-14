/**
 * Minimal server-side Firestore reader that authenticates with the project's
 * service account and calls the Firestore REST API directly.
 *
 * The unauthenticated Web SDK used by `firebase-compat` is still bound by
 * security rules, so it cannot read sessions that are not world-readable. This
 * helper signs a JWT with the service account (RS256, WebCrypto) and reads the
 * document as the service account, bypassing rules — which lets the public
 * report endpoint serve sessions of any status.
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/datastore';

let cachedToken: { token: string; expiresAt: number } | null = null;

function b64urlFromBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlFromString(str: string): string {
  return b64urlFromBytes(new TextEncoder().encode(str));
}

function pemToBytes(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const binary = atob(body);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function getCredentials(): { projectId: string; clientEmail: string; privateKey: string } | null {
  const projectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'zenit-tracker';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!clientEmail || !privateKey) return null;
  return { projectId, clientEmail, privateKey };
}

export async function getServiceAccountToken(): Promise<string | null> {
  const creds = getCredentials();
  if (!creds) return null;

  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt - 60 > now) return cachedToken.token;

  const header = b64urlFromString(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64urlFromString(
    JSON.stringify({
      iss: creds.clientEmail,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signingInput = `${header}.${claims}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToBytes(creds.privateKey),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signingInput),
  );
  const jwt = `${signingInput}.${b64urlFromBytes(new Uint8Array(signature))}`;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!res.ok) return null;
  const json: any = await res.json();
  if (!json?.access_token) return null;
  cachedToken = { token: json.access_token, expiresAt: now + (json.expires_in || 3600) };
  return cachedToken.token;
}

/** Decode a single Firestore REST value into a plain JS value. */
export function decodeFirestoreValue(value: any): any {
  if (!value || typeof value !== 'object') return null;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) return (value.arrayValue?.values || []).map(decodeFirestoreValue);
  if ('mapValue' in value) return decodeFirestoreFields(value.mapValue?.fields || {});
  if ('referenceValue' in value) return value.referenceValue;
  if ('geoPointValue' in value) return value.geoPointValue;
  if ('bytesValue' in value) return value.bytesValue;
  return null;
}

/** Decode a Firestore REST `fields` map into a plain JS object. */
export function decodeFirestoreFields(fields: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const key of Object.keys(fields || {})) out[key] = decodeFirestoreValue(fields[key]);
  return out;
}

/**
 * Normalise a session's `testCases` so the report always receives an array.
 *
 * Most sessions store `testCases` as an array of full case objects. A few
 * legacy/partial sessions instead store only the *results* as a map keyed by
 * the case's `orderIndex` (e.g. `{ "100": { status: "Pass", … } }`) with the
 * case definitions living in a `testSuites` document. When that shape is
 * detected, `suiteCases` (the matching suite's full cases) is merged in so the
 * report can still show titles/steps/expected results while keeping the stored
 * results. Results whose key is absent from the suite are appended so nothing
 * is dropped.
 */
export function mergeSuiteResults(suiteCases: any, resultMap: Record<string, any>): any[] {
  const map = resultMap && typeof resultMap === 'object' ? resultMap : {};
  const out: any[] = [];
  const used = new Set<string>();
  if (Array.isArray(suiteCases)) {
    suiteCases.forEach((c: any, i: number) => {
      const key = String(c?.orderIndex ?? i);
      used.add(key);
      out.push({ ...c, ...(map[key] || {}), id: c?.id ?? key });
    });
  }
  for (const key of Object.keys(map)) {
    if (used.has(key)) continue;
    out.push({ id: key, orderIndex: Number(key), testCaseTitle: `Test case ${key}`, ...map[key] });
  }
  return out;
}

/**
 * Find a `testSuites` document whose `totalCases` matches the given total.
 * Used to recover case definitions for sessions that only store results.
 */
export async function fetchSuiteMatchingTotal(
  total: number,
  platform?: string,
): Promise<Record<string, any> | null> {
  const creds = getCredentials();
  if (!creds) throw new Error('Service account credentials are not configured');
  const token = await getServiceAccountToken();
  if (!token) throw new Error('Failed to obtain service account token');

  const base = `https://firestore.googleapis.com/v1/projects/${creds.projectId}/databases/(default)/documents`;
  const res = await fetch(`${base}/testSuites?pageSize=100`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const json: any = await res.json();
  const suites = (json.documents || []).map((d: any) => ({
    id: d.name.split('/').pop(),
    ...decodeFirestoreFields(d.fields || {}),
  }));
  const matches = suites.filter((s: any) => Number(s.totalCases) === total);
  if (matches.length === 0) return null;
  if (platform && matches.length > 1) {
    const exact = matches.find((s: any) => s.platform === platform || s.name?.includes(platform));
    if (exact) return exact;
  }
  return matches[0];
}

/**
 * Read a session document by id as the service account. Checks `sessions` first
 * then the legacy `testSessions` collection. Returns the decoded document or
 * null when neither exists.
 */
export async function fetchSessionById(sessionId: string): Promise<Record<string, any> | null> {
  const creds = getCredentials();
  if (!creds) throw new Error('Service account credentials are not configured');

  const token = await getServiceAccountToken();
  if (!token) throw new Error('Failed to obtain service account token');

  const base = `https://firestore.googleapis.com/v1/projects/${creds.projectId}/databases/(default)/documents`;
  for (const collection of ['sessions', 'testSessions']) {
    const res = await fetch(`${base}/${collection}/${encodeURIComponent(sessionId)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (res.status === 200) {
      const json: any = await res.json();
      return { id: sessionId, ...decodeFirestoreFields(json.fields || {}) };
    }
    if (res.status !== 404) {
      const text = await res.text();
      throw new Error(`Firestore read failed (${res.status}): ${text.slice(0, 200)}`);
    }
  }
  return null;
}
