import { expect, type Page } from '@playwright/test';

/** Shared demo password for every seeded account (see seed-testcases.ts). */
export const DEMO_PASSWORD = 'Password123!';

export const ACCOUNTS = {
  admin: 'admin@test.cobalt.ma',
  recruiter: 'recruteur.pro@test.cobalt.ma',
  candidate: 'candidat.ensias@test.cobalt.ma',
} as const;

/**
 * Attaches a collector for real browser errors — uncaught exceptions and
 * `console.error` — while ignoring dev-server noise that is not a product
 * defect (favicon/asset 404s, React DevTools nudge, HMR chatter).
 */
export function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  const IGNORE = [
    /favicon/i,
    /Download the React DevTools/i,
    /\[Fast Refresh\]/i,
    /ERR_ABORTED/i,
  ];
  const keep = (text: string) => !IGNORE.some((re) => re.test(text));

  page.on('console', (msg) => {
    if (msg.type() === 'error' && keep(msg.text())) errors.push(`console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    if (keep(err.message)) errors.push(`pageerror: ${err.message}`);
  });
  return errors;
}

/** Fails if the page scrolls horizontally — the classic responsive-break tell. */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const el = document.documentElement;
    // 1px of rounding slack so sub-pixel layouts don't flake the check.
    return el.scrollWidth - el.clientWidth;
  });
  expect(overflow, 'horizontal scrollbar present (layout overflows viewport)').toBeLessThanOrEqual(1);
}

/** Logs in through the real form and waits for the dashboard to render. */
export async function login(page: Page, email: string, password = DEMO_PASSWORD): Promise<void> {
  await page.goto('/login');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard', { timeout: 20_000 });
}
