import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * Integration suite config.
 *
 * The main `vitest.config.ts` excludes the integration directory, so the unit
 * run stays hermetic. That exclusion also made `vitest run src/tests/integration`
 * match nothing - a CLI filter cannot override `exclude` - which is why
 * `test:int` reported "No test files found". Integration tests therefore need
 * their own config, which is what this is.
 *
 * These tests hit a real Postgres (CI provides one) and exercise the ZenStack
 * access policies, so they are slower and order-sensitive by nature.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "server-only": "node:events",
    },
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    // The helpers TRUNCATE shared tables, so files must not interleave.
    fileParallelism: false,
    globals: true,
    hookTimeout: 60_000,
    include: ["src/tests/integration/**/*.{test,spec}.ts"],
    setupFiles: ["./src/tests/setup-env.ts"],
    // Database round-trips plus TRUNCATE-based cleanup need more headroom than
    // the 15s unit default.
    testTimeout: 60_000,
  },
});
