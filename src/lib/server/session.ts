/**
 * Signed session tokens.
 *
 * The old gate only checked that a `firebase-auth-session` cookie existed, but
 * the cookie was the literal string "true" written by client JavaScript — so
 * anyone could forge it. This module replaces that with an HMAC-signed token
 * containing the Firebase uid/email and an expiry.
 *
 * The signing key is `AUTH_SESSION_SECRET` when present, otherwise the
 * server-only Firebase private key (already required for Firestore admin
 * access). No secret ever reaches the browser.
 *
 * Edge-runtime safe: only WebCrypto, TextEncoder, btoa/atob are used.
 */

export const SESSION_COOKIE = 'firebase-auth-session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24h

export interface SessionUser {
  uid: string;
  email: string;
  /** Unix seconds. 0 for identities injected by middleware. */
  exp: number;
}

const encoder = new TextEncoder();

function base64UrlFromBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function bytesFromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(
    value.length + ((4 - (value.length % 4)) % 4),
    '=',
  );
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function signingSecret(): string {
  return (
    process.env.AUTH_SESSION_SECRET ||
    process.env.FIREBASE_PRIVATE_KEY ||
    'zenit-development-only-session-secret'
  );
}

let cachedKey: Promise<CryptoKey> | null = null;

function hmacKey(): Promise<CryptoKey> {
  // Import once per isolate — importing the key on every request is wasteful.
  if (!cachedKey) {
    cachedKey = crypto.subtle.importKey(
      'raw',
      encoder.encode(signingSecret()),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify'],
    );
  }
  return cachedKey;
}

export async function signSession(
  user: { uid: string; email: string },
  ttlSeconds: number = SESSION_TTL_SECONDS,
): Promise<string> {
  const payload: SessionUser = {
    uid: user.uid,
    email: user.email,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const encoded = base64UrlFromBytes(encoder.encode(JSON.stringify(payload)));
  const key = await hmacKey();
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(encoded));
  return `${encoded}.${base64UrlFromBytes(new Uint8Array(signature))}`;
}

export async function verifySession(token?: string | null): Promise<SessionUser | null> {
  if (!token || !token.includes('.')) return null;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;

  try {
    const key = await hmacKey();
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      bytesFromBase64Url(signature),
      encoder.encode(encoded),
    );
    if (!valid) return null;

    const json = JSON.parse(new TextDecoder().decode(bytesFromBase64Url(encoded)));
    if (!json?.uid || typeof json.uid !== 'string') return null;
    if (typeof json.exp !== 'number' || json.exp <= Math.floor(Date.now() / 1000)) return null;

    return { uid: json.uid, email: typeof json.email === 'string' ? json.email : '', exp: json.exp };
  } catch {
    return null;
  }
}

export function isInternalEmail(email?: string | null): boolean {
  return !!email && email.toLowerCase().endsWith('@sunnetwork.in');
}
