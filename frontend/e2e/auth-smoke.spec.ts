import { test, expect } from '@playwright/test';
import { ACCOUNTS } from './helpers';

/**
 * Auth negative path. The successful per-role logins live in journeys.spec.ts
 * (one login per role) so the whole `flows` project stays within the login
 * rate limit (5/60s); this file adds the single deliberate failure.
 */
test('rejects a wrong password with an inline error (no crash, stays on /login)', async ({ page }) => {
  await page.goto('/login');
  await page.locator('#login-email').fill(ACCOUNTS.candidate);
  await page.locator('#login-password').fill('wrong-password-xyz');
  await page.locator('button[type="submit"]').click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});
