import { test, expect } from '@playwright/test';

/**
 * Route smoke crawl: every route must resolve without a server error (5xx)
 * and without rendering the Next.js error boundary.
 *
 * Auth-gated routes are expected to redirect to /login — that still counts as
 * "working". What we guard against is a crash: 500 responses or the
 * "Application error" / "something went wrong" boundary text.
 */

const PUBLIC_ROUTES = [
  '/',
  '/about',
  '/landing',
  '/login',
  '/signup',
  '/forgot-password',
  '/verify/demo',
  '/report/demo',
];

const APP_ROUTES = [
  '/ai-settings',
  '/analytics',
  '/analytics/bugs',
  '/analytics/dashboard',
  '/analytics/leaderboard',
  '/apps',
  '/billing',
  '/billing/checkout',
  '/bugs',
  '/confluence',
  '/dashboard',
  '/dashboard/clevertap-tracker',
  '/dashboard/locator-studio',
  '/dashboard/new-session',
  '/dashboard/repository',
  '/dashboard/sessions',
  '/dashboard/vision',
  '/integrations',
  '/investigations',
  '/keepr',
  '/keepr/audit-log',
  '/keepr/my-devices',
  '/keepr/team',
  '/kpi',
  '/nexus',
  '/notes',
  '/onboarding',
  '/performance',
  '/profile',
  '/tasks',
  '/team',
  '/test-suite',
  '/test-suite/plans',
  '/test-suite/plans/new',
  '/test-suite/runs',
  '/wrklog',
];

const ERROR_TEXT = /Application error|something went wrong|Unhandled Runtime Error|Internal Server Error/i;

/**
 * Navigate with a bounded retry.
 *
 * The crawl runs against the live edge, where a request can intermittently hit
 * `net::ERR_TIMED_OUT` (cold worker start, edge propagation right after a
 * deploy). Those are transport timeouts, not server errors, so retrying is the
 * right response. A genuine 5xx returns a response (no timeout) and is still
 * reported by the assertions below.
 */
async function gotoWithRetry(page: import('@playwright/test').Page, route: string) {
  const attempts = 3;
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (err) {
      lastErr = err;
      await page.waitForTimeout(1500);
    }
  }
  throw lastErr;
}

async function checkRoute(page: import('@playwright/test').Page, route: string) {
  const res = await gotoWithRetry(page, route);
  expect(res, `no response for ${route}`).not.toBeNull();
  // Redirects land on 200; a raw 5xx is a hard failure.
  expect(res!.status(), `HTTP status for ${route}`).toBeLessThan(500);

  // Wait for the body to render text (SSR or after hydration). We cannot rely
  // on `networkidle`: the service worker + Firestore long-poll keep the network
  // busy indefinitely. Polling the rendered text is the reliable signal.
  await page
    .waitForFunction(() => (document.body?.innerText || '').trim().length > 0, null, { timeout: 15000 })
    .catch(() => {});

  const body = (await page.locator('body').innerText().catch(() => '')) || '';
  expect(body, `error boundary rendered on ${route}`).not.toMatch(ERROR_TEXT);
  expect(body.trim().length, `empty body on ${route}`).toBeGreaterThan(0);
}

for (const route of [...PUBLIC_ROUTES, ...APP_ROUTES]) {
  test(`route works: ${route}`, async ({ page }) => {
    test.setTimeout(45000);
    await checkRoute(page, route);
  });
}
