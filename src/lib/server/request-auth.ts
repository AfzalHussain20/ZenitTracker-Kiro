/**
 * Identity helpers for API route handlers.
 *
 * Prefers the signed session cookie (verified locally), and falls back to the
 * identity headers middleware injects after it verifies the same cookie.
 */
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession, isInternalEmail, type SessionUser } from './session';

export type { SessionUser };
export { isInternalEmail };

export async function getRequestUser(req: NextRequest): Promise<SessionUser | null> {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  if (cookie) {
    const verified = await verifySession(cookie);
    if (verified) return verified;
  }

  // Middleware strips client-supplied copies of these headers before setting
  // them, so they are trustworthy when present.
  const uid = req.headers.get('x-zenit-uid');
  if (uid) {
    return { uid, email: req.headers.get('x-zenit-email') || '', exp: 0 };
  }
  return null;
}

export function unauthorized(message = 'Unauthorized'): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function forbidden(message = 'Forbidden'): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}
