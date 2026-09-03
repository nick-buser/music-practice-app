import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke-level e2e suite. The dev server is auto-started here; in CI you'd want
 * to point at a preview build instead, but the dev server keeps the loop tight
 * locally.
 *
 * Browser setup:
 * - The suite runs against the locally installed Google Chrome via `channel: 'chrome'`,
 *   so no browser download is required.
 * - `npx playwright install chromium` remains the path for environments that want
 *   the bundled browser instead.
 * - In our remote execution sandbox the CDN is blocked, so the browsers live at
 *   `/opt/pw-browsers`. Set `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` before
 *   running `npm run test:e2e`. The @playwright/test version is pinned to the
 *   matching browser build.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  reporter: process.env.CI ? 'list' : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [
    // Use the installed Google Chrome instead of a bundled chromium, since this
    // machine deliberately does not install Playwright's browser downloads (disk
    // discipline). CI runs npx playwright install, so the channel simply resolves
    // to the Chrome present there.
    { name: 'chromium', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
