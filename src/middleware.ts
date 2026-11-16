import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession, isInternalEmail } from '@/lib/server/session';
import { checkRateLimit } from '@/lib/server/rate-limit';

/**
 * Authentication gate.
 *
 * The previous version treated any non-empty `firebase-auth-session` cookie as
 * authenticated, but that cookie was the literal string "true" written by
 * client JavaScript. It is now an HMAC-signed token minted by
 * `/api/auth/session`, so it cannot be forged.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const rawToken = request.cookies.get(SESSION_COOKIE)?.value;
  const session = rawToken ? await verifySession(rawToken) : null;
  const isAuthenticated = !!session;

  // Pages that must work without a session.
  const publicRoutes = ['/login', '/signup', '/forgot-password'];
  const publicPagePrefixes = ['/scan/', '/report/', '/verify/', '/landing'];

  // APIs that are intentionally public. Jira and Keepr are NOT here: they
  // proxy company credentials and must require a session.
  const isPublicApi =
    pathname.startsWith('/api/public/') ||
    pathname === '/api/geo' ||
    pathname === '/api/auth/session' ||
    // The QR scan page needs to read a single device without logging in.
    (request.method === 'GET' &&
      pathname !== '/api/keepr/device/list' &&
      /^\/api\/keepr\/device\/[^/]+$/.test(pathname));

  const isApiRoute = pathname.startsWith('/api/');
  const isPublicPage = publicPagePrefixes.some(prefix => pathname.startsWith(prefix));
  const isPublicRoute = publicRoutes.includes(pathname) || isPublicPage || isPublicApi;

  if (pathname === '/') {
    return NextResponse.redirect(new URL(isAuthenticated ? '/dashboard' : '/login', request.url));
  }

  // Signed-in users should not sit on the auth screens.
  if (isAuthenticated && publicRoutes.includes(pathname)) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (!isAuthenticated && isApiRoute && !isPublicApi) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isAuthenticated && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Company-only namespaces. External accounts must never reach these even if
  // they are signed in, because they use the company's Jira/Confluence/Keepr
  // credentials and data.
  const internalOnlyPrefixes = [
    '/api/jira/',
    '/api/confluence/',
    '/api/keepr/',
    '/api/ai/jira-insights',
    '/api/ai/investigate',
    '/api/ai/investigations',
  ];
  if (
    isAuthenticated &&
    isApiRoute &&
    !isPublicApi &&
    internalOnlyPrefixes.some(prefix => pathname.startsWith(prefix)) &&
    !isInternalEmail(session?.email)
  ) {
    return NextResponse.json({ error: 'This feature is available to Sun Network staff only' }, { status: 403 });
  }

  // Throttle AI endpoints per signed-in user. The expensive provider keys are
  // shared, so one account must not be able to burn the whole daily quota.
  if (isAuthenticated && isApiRoute && pathname.startsWith('/api/ai/')) {
    if (!checkRateLimit(request, `ai:${session?.uid}`, 60, 60_000)) {
      return NextResponse.json({ error: 'Too many AI requests. Please slow down.' }, { status: 429 });
    }
  }

  // Forward the verified identity to route handlers. Strip any client-supplied
  // copies first so they cannot be spoofed.
  const headers = new Headers(request.headers);
  headers.delete('x-zenit-uid');
  headers.delete('x-zenit-email');
  if (session) {
    headers.set('x-zenit-uid', session.uid);
    headers.set('x-zenit-email', session.email);
  }

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|logo.svg|manifest.json|sw.js|.*\\..*).*)',
  ],
};
