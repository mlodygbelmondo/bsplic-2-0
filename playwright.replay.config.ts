import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'replay.spec.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 2,
  timeout: 30_000,
  reporter: [['list'], ['html', { outputFolder: 'playwright-replay-report', open: 'never' }]],
  outputDir: 'test-results/replay',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    timezoneId: 'Europe/Warsaw',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 }, launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
  ],
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
