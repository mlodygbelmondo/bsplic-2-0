import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testMatch: "slots.spec.ts",
  workers: 2,
  timeout: 30_000,
  outputDir: "test-results/slots",
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:8187",
    serviceWorkers: "block",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    { name: "phone", use: { ...devices["iPhone 13"], browserName: "webkit" } },
  ],
  webServer: {
    command:
      "VITE_SUPABASE_URL=https://slots-test.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=fixture-only npm run dev -- --host 127.0.0.1 --port 8187",
    url: "http://127.0.0.1:8187",
    reuseExistingServer: false,
  },
});
