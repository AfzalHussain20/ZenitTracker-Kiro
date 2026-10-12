import { test, expect } from '@playwright/test';

/**
 * Production smoke tests.
 *
 * These verify the deployed app boots and serves core routes.
 * Point E2E_BASE_URL at an environment (defaults to the live app)
 * or run against a local server via the playwright `webServer` config.
 */

test('app boots and serves a page', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.ok()).toBeTruthy();
  await expect(page).toHaveTitle(/Zenit Tracker/);
});

test('login page renders the auth form', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
});