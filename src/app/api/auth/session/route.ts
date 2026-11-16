/**
 * POST   /api/auth/session — exchange a Firebase ID token for a signed,
 *                            HttpOnly session cookie.
 * DELETE /api/auth/session — clear the session cookie.
 *
 * The client sends `Authorization: Bearer <firebase-id-token>`. We verify it
 * with Google Identity Toolkit (`accounts:lookup`), which needs only the public
 * web API key, then mint an HMAC-signed cookie that middleware can verify
 * without a Firebase Admin SDK (not available on Cloudflare Workers).
 */
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession } from '@/lib/server/session';
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rate-limit';

export const dynamic = 'force-dynamic';

const FIREBASE_API_KEY =
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyARGoyDl7VRkePFnSzqUOvNNC_4oVs1mcA';

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  };
}

export async function POST(req: NextRequest) {
  if (!checkRateLimit(req, 'auth-session', 30, 60_000)) {
    return rateLimitResponse(60);
  }

  const header = req.headers.get('authorization') || '';
  const idToken = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!idToken) {
    return NextResponse.json({ error: 'Missing bearer token' }, { status: 401 });
  }

  let account: any;
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
        cache: 'no-store',
      },
    );
    if (!res.ok) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
    const json: any = await res.json();
    account = json?.users?.[0];
  } catch {
    return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 });
  }

  if (!account?.localId) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  const session = await signSession({
    uid: account.localId,
    email: account.email || '',
  });

  const response = NextResponse.json({
    uid: account.localId,
    email: account.email || '',
    displayName: account.displayName || '',
    expiresIn: SESSION_TTL_SECONDS,
  });
  response.cookies.set(SESSION_COOKIE, session, {
    ...cookieOptions(),
    maxAge: SESSION_TTL_SECONDS,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, '', { ...cookieOptions(), maxAge: 0 });
  return response;
}
