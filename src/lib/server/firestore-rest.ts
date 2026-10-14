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
