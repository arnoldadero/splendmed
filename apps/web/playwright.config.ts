import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const baseURL = `http://127.0.0.1:${PORT}`;

/*
 * Artifacts are off by default. Video and trace are large, and this machine is
 * running very close to full; a failing run that fills the disk helps nobody.
 * Turn trace on locally with PWTRACE=1 when actually debugging a failure.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list']],
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL,
    video: 'off',
    screenshot: 'off',
    trace: process.env.PWTRACE ? 'on-first-retry' : 'off',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  /*
   * A dedicated port so an E2E run never collides with a dev server someone has
   * open on 3000. Runs the production build: that is what deploys, and it is the
   * build that caught the public/products resolution bug.
   */
  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54421',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'e2e-placeholder-anon-key',
      JULEB_DRIVER: 'mock',
    },
  },
});
