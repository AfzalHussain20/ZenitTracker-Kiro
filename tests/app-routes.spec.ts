import { test, expect, type BrowserContext, type Page } from '@playwright/test';

/**
 * Authenticated route crawl.
 *
 * Signs in once with the E2E_EMAIL / E2E_PASSWORD credentials, then visits every
 * app route (behind the auth gate) and asserts each renders without a 5xx or the
 * Next.js error boundary.
 *
 *   $env:E2E_EMAIL="qa-crawl-temp@sunnetwork.in"
 *   $env:E2E_PASSWORD="..."
 *   npx playwright test tests/app-routes.spec.ts
 */

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

const ERROR_TEXT =
  /Application error|something went wrong|Unhandled Runtime Error|Internal Server Error/i;

const APP_ROUTES = [
  '/dashboard',
  '/dashboard/sessions',
  '/dashboard/new-session',
  '/dashboard/repository',
  '/dashboard/clevertap-tracker',
  '/dashboard/locator-studio',
  '/dashboard/vision',
  '/analytics',
  '/analytics/bugs',
  '/analytics/dashboard',
  '/analytics/leaderboard',
  '/kpi',
  '/team',
  '/tasks',
  '/bugs',
  '/notes',
  '/wrklog',
  '/performance',
  '/test-suite',
  '/test-suite/plans',
  '/test-suite/plans/new',
  '/test-suite/runs',
  '/keepr',
  '/keepr/my-devices',
  '/keepr/team',
  '/keepr/audit-log',
  '/investigations',
  '/confluence',
  '/integrations',
  '/apps',
  '/nexus',
  '/profile',
  '/billing',
  '/ai-settings',
  '/about',
  '/onboarding',
];

test.describe('authenticated app routes', () => {
  test.describe.configure({ mode: 'serial' });

  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120000);
    if (!EMAIL || !PASSWORD) {
      throw new Error('Set E2E_EMAIL and E2E_PASSWORD to run the authenticated crawl');
    }
    context = await browser.newContext();
    page = await context.newPage();

    // The login form is a controlled React form; if we click before hydration
    // the browser performs a native GET submit (leaving creds in the URL). Retry
    // a few times until React handles the submit and we land on /dashboard.
    let ok = false;
    for (let attempt = 0; attempt < 4 && !ok; attempt++) {
      await page.goto('/login', { waitUntil: 'domcontentloaded' });
      await page.getByLabel('Email', { exact: true }).waitFor({ state: 'visible', timeout: 15000 });
      await page.waitForTimeout(2500);
      await page.getByLabel('Email', { exact: true }).fill(EMAIL);
      await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
      await page.getByRole('button', { name: /Sign In/i }).click();
      try {
        await page.waitForURL(/\/dashboard/, { timeout: 15000 });
        ok = true;
      } catch {
        /* native submit or transient nav — retry */
      }
    }
    if (!ok) throw new Error('login did not reach /dashboard after retries');
  });

  test.afterAll(async () => {
    await context?.close();
  });

  for (const route of APP_ROUTES) {
    test(`works: ${route}`, async () => {
      test.setTimeout(45000);

      const res = await page.goto(route, { waitUntil: 'domcontentloaded' });
      expect(res, `no response for ${route}`).not.toBeNull();
      expect(res!.status(), `HTTP status for ${route}`).toBeLessThan(500);

      // Wait for rendered text (hydration / data fetch tolerant).
      await page
        .waitForFunction(() => (document.body?.innerText || '').trim().length > 0, null, { timeout: 15000 })
        .catch(() => {});

      const body = (await page.locator('body').innerText().catch(() => '')) || '';
      expect(body, `error boundary rendered on ${route}`).not.toMatch(ERROR_TEXT);
      expect(body.trim().length, `empty body on ${route}`).toBeGreaterThan(0);

      // The middleware must not bounce a signed-in user back to login.
      expect(page.url(), `redirected to login from ${route}`).not.toMatch(/\/login(\?|$)/);
    });
  }
});
