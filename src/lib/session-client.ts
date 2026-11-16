/**
 * Client-side session bootstrap.
 *
 * Firebase persists the signed-in user in the browser, but the server needs a
 * verifiable session. After sign-in (and on every app load) we exchange the
 * current Firebase ID token for an HttpOnly, HMAC-signed cookie.
 */
import type { User } from 'firebase/auth';

export async function establishSession(user: User): Promise<boolean> {
  try {
    const idToken = await user.getIdToken();
    const res = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` },
      cache: 'no-store',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function clearSession(): Promise<void> {
  try {
    await fetch('/api/auth/session', { method: 'DELETE', cache: 'no-store' });
  } catch {
    // Best effort — signing out of Firebase still removes local access.
  }
}
