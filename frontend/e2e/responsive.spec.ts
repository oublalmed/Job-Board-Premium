import { test, expect } from '@playwright/test';
import { collectPageErrors, expectNoHorizontalOverflow } from './helpers';

/**
 * Multi-viewport sweep of the public (unauthenticated) pages. Each Playwright
 * project pins a viewport (1920 / 1366 / 768 / 390), so this file runs once per
 * size and asserts, on every page, that (1) nothing overflows horizontally and
 * (2) the browser logged no uncaught error.
 */
const PUBLIC_PAGES = [
  { name: 'landing', path: '/' },
  { name: 'login', path: '/login' },
  { name: 'register', path: '/register' },
  { name: 'forgot-password', path: '/forgot-password' },
  { name: 'contact', path: '/contact' },
  { name: 'privacy', path: '/privacy' },
  { name: 'terms', path: '/terms' },
];

for (const { name, path } of PUBLIC_PAGES) {
  test(`${name} renders cleanly with no horizontal overflow`, async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto(path, { waitUntil: 'networkidle' });
    await expect(page.locator('body')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    expect(errors, `console/page errors on ${path}:\n${errors.join('\n')}`).toHaveLength(0);
  });
}
