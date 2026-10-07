import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for MaySync's browser QA pass.
 *
 * These are *integration* checks against a running stack, kept separate from the
 * Vitest unit suite (`npm run test`). They expect the frontend on :3001 and the
 * API on :3000 — start both (`npm run dev` here, `npm run start:dev` in the API)
 * then run `npm run e2e`. Seeded demo accounts use the password `Password123!`.
 *
 * `reuseExistingServer` keeps the dev servers you already have running; CI would
 * flip `CI=1` and boot its own.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3001';

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/.artifacts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'e2e/.report', open: 'never' }]],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'fr-FR',
  },
  projects: [
    // Responsive layout sweep — runs on every viewport, no authentication, so
    // it never touches the (strictly throttled, 5/min) login endpoint.
    {
      name: 'responsive-1920',
      testMatch: /responsive\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } },
    },
    {
      name: 'responsive-1366',
      testMatch: /responsive\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } },
    },
    {
      name: 'responsive-768',
      testMatch: /responsive\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'responsive-390',
      testMatch: /responsive\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
    },
    // Behaviour (auth + per-role journeys) — runs ONCE on a single viewport.
    // These exercise logic, not layout, and each real login counts against the
    // auth rate limit (5/60s), so the whole file is budgeted to ≤5 logins:
    // one success per role (3) + one deliberate failure (1) = 4.
    {
      name: 'flows',
      testMatch: /(auth-smoke|journeys)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
});
