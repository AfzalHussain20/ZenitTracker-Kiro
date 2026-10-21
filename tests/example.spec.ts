import { test, expect } from '@playwright/test';

/**
 * Production smoke tests.
 *
 * These verify the deployed app boots and serves core routes.
 * Point E2E_BASE_URL at an environment (defaults to the live app)
 * or run against a local server via the playwright `webServer` config.
 */

test('app boots and serves a page', async ({ page }) => {
  // The live edge can intermittently time out (cold start / post-deploy
  // propagation); retry the transport before asserting on the response.
  let response = null;
  for (let i = 0; i < 3 && !response; i++) {
    response = await page
      .goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 })
      .catch(() => null);
    if (!response) await page.waitForTimeout(1500);
  }
  expect(response?.ok()).toBeTruthy();
  await expect(page).toHaveTitle(/Zenit Tracker/);
});

test('login page renders the auth form', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
});