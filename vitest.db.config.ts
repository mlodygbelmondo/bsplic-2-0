import { defineConfig } from "vitest/config";
import path from "path";

// Behavioral SQL contract tests against a local Supabase stack.
// See src/test/db/README.md for the required local-only environment.
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/test/db/**/*.{test,spec}.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
