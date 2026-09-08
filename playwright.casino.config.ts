import { defineConfig, devices } from '@playwright/test';
import slotsConfig from './playwright.slots.config';
export default defineConfig({
  ...slotsConfig,
  testMatch: 'casino-mobile.spec.ts',
  outputDir: 'test-results/casino-mobile',
  use: { ...slotsConfig.use, reducedMotion: 'reduce' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'phone', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
    { name: 'compact', use: { ...devices['Desktop Chrome'], viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true } },
  ],
});
