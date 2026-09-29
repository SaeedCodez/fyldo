import { defineConfig } from '@playwright/test';

/**
 * Two projects:
 *  - harness: static pages (tests/harness) against the built assets, no WordPress — fast visual/DOM checks.
 *  - wp:      a real WordPress in wp-env (npm run env:start) with the demo plugins — end-to-end and coexistence.
 *
 * Locally the Playwright CDN may be unreachable; PLAYWRIGHT_CHANNEL=chrome uses the installed Google Chrome.
 */
const channel = process.env.PLAYWRIGHT_CHANNEL || undefined;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { channel, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    {
      name: 'harness',
      testDir: './e2e/harness',
      use: { baseURL: 'http://127.0.0.1:4173' },
    },
    {
      name: 'wp-setup',
      testDir: './e2e/wp',
      testMatch: /auth\.setup\.ts/,
      use: { baseURL: process.env.WP_BASE_URL ?? 'http://localhost:8888' },
    },
    {
      name: 'wp',
      testDir: './e2e/wp',
      testIgnore: /auth\.setup\.ts/,
      dependencies: ['wp-setup'],
      fullyParallel: false,
      workers: 1,
      use: { baseURL: process.env.WP_BASE_URL ?? 'http://localhost:8888', storageState: 'e2e/.auth/admin.json' },
    },
  ],
  webServer: [
    {
      command: 'node tools/dev/serve.mjs 4173',
      url: 'http://127.0.0.1:4173/tests/harness/',
      reuseExistingServer: true,
    },
  ],
});
