import { test, expect } from '@playwright/test';

/**
 * Lead-only editing flow on the results report.
 *
 *   $env:E2E_EMAIL="..."; $env:E2E_PASSWORD="..."; $env:E2E_SESSION="<id>"
 *   npx playwright test tests/lead-results.spec.ts
 */

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;
const SESSION = process.env.E2E_SESSION;

test('lead can open the results report and the fail/skip editors', async ({ page }) => {
  test.setTimeout(120000);
  if (!EMAIL || !PASSWORD || !SESSION) {
    throw new Error('Set E2E_EMAIL, E2E_PASSWORD and E2E_SESSION');
  }

  // Sign in (retry until React handles the submit, not a native GET).
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email', { exact: true }).waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(2500);
  await page.getByLabel('Email', { exact: true }).fill(EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: /Sign In/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30000 });

  await page.goto(`/dashboard/session/${SESSION}/results`, { waitUntil: 'domcontentloaded' });

  // The Actions column only renders for a lead.
  await expect(page.getByRole('columnheader', { name: 'Actions' })).toBeVisible({ timeout: 30000 });

  // Fail editor: opens with a live Jira bug-id input.
  await page.getByTitle('Mark Fail').first().click();
  await expect(page.getByText('Mark as Failed')).toBeVisible();
  const bugInput = page.getByPlaceholder('e.g. SUN-1234');
  await expect(bugInput).toBeVisible();

  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByText('Mark as Failed')).toBeHidden();

  // Skip editor opens.
  await page.getByTitle('Skip').first().click();
  await expect(page.getByText('Skip Test Case')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
});
