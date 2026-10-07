import { test, expect } from '@playwright/test';
import { ACCOUNTS, collectPageErrors, expectNoHorizontalOverflow, login } from './helpers';

/**
 * Critical per-role journeys against the seeded demo data (16 indexed
 * candidates, so the CVthèque spans two pages of 12).
 *
 * Budget note: each test logs in exactly once (the login endpoint is throttled
 * to 5/60s). Combined with the single deliberate failure in auth-smoke, this
 * file keeps the whole `flows` project at 4 real logins — under the limit.
 * Each test therefore also folds in the "signed in → reached dashboard →
 * shell doesn't overflow or throw" smoke assertions, rather than logging in
 * again for them separately.
 */

test('recruiter: reaches dashboard, then CVthèque search + pagination work', async ({ page }) => {
  const errors = collectPageErrors(page);
  await login(page, ACCOUNTS.recruiter);
  await expect(page).toHaveURL(/\/dashboard/);
  await expectNoHorizontalOverflow(page);

  await page.goto('/candidates');
  // Results only appear after a search is run; an empty query lists everyone.
  await page.getByPlaceholder('Rechercher des candidats…').press('Enter');
  await expect(page.getByRole('heading', { level: 3 }).first()).toBeVisible();
  await expect(page.getByText('Page 1')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  // Pagination fix (16 candidates > 12/page → a real second page exists).
  const next = page.getByRole('button', { name: 'Suivant' });
  await expect(next).toBeEnabled();
  await next.click();
  await expect(page.getByText('Page 2')).toBeVisible();

  expect(errors, `errors on recruiter journey:\n${errors.join('\n')}`).toHaveLength(0);
});

test('candidate: reaches dashboard, then assessments catalogue is clean', async ({ page }) => {
  const errors = collectPageErrors(page);
  await login(page, ACCOUNTS.candidate);
  await expect(page).toHaveURL(/\/dashboard/);
  await expectNoHorizontalOverflow(page);

  await page.goto('/assessments');
  await expect(page.locator('body')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  // Regression guard: the E2E-fixture specialties ("E2E … <timestamp>") must
  // never surface in the real catalogue.
  await expect(page.getByText(/E2E\s/i)).toHaveCount(0);

  expect(errors, `errors on candidate journey:\n${errors.join('\n')}`).toHaveLength(0);
});

test('admin: reaches dashboard, then analytics overview renders', async ({ page }) => {
  const errors = collectPageErrors(page);
  await login(page, ACCOUNTS.admin);
  await expect(page).toHaveURL(/\/dashboard/);
  await expectNoHorizontalOverflow(page);

  await page.goto('/admin/analytics');
  await expect(page.locator('body')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  expect(errors, `errors on admin journey:\n${errors.join('\n')}`).toHaveLength(0);
});
