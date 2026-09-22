import { defineConfig, devices } from '@playwright/test';
import slotsConfig from './playwright.slots.config';

export default defineConfig({
  ...slotsConfig,
  testMatch: 'mobile-viewport.spec.ts',
  outputDir: 'test-results/mobile-viewport',
  projects: [
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
