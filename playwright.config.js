import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Force headless mode for CI compatibility
        headless: true,
        launchOptions: {
          args: [
            // Security flags for CI/sandboxed environments
            '--no-sandbox',
            '--disable-setuid-sandbox',

            // Performance and stability flags
            '--disable-dev-shm-usage',  // Avoid /dev/shm issues
            '--disable-gpu',            // Disable GPU in headless mode
            '--disable-software-rasterizer',
            '--disable-dev-tools',

            // CRITICAL: --single-process prevents shared memory permission errors
            // in restricted environments. Remove if running in a standard environment
            // causes performance issues.
            '--single-process',
          ],
        },
      },
    },
  ],

  webServer: {
    command: 'npx http-server src -p 8080 -c-1',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
