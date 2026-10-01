import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Separate config: vitest.config.ts excludes src/tests/integration and a CLI path filter cannot override `exclude`.
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
    fileParallelism: false,
    globals: true,
    hookTimeout: 60_000,
    include: ["src/tests/integration/**/*.{test,spec}.ts"],
    setupFiles: ["./src/tests/setup-env.ts"],
    testTimeout: 60_000,
  },
});
