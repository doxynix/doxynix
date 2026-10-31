import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Separate from `test` and `test:int`: these scenarios hit a Stripe sandbox and a running app, so
// they never run in CI. Without sandbox credentials every case is skipped as `cannot-verify`.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": "node:events",
    },
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    fileParallelism: false,
    globals: true,
    hookTimeout: 180_000,
    include: ["tests/stripe/**/*.test.ts"],
    setupFiles: ["./src/tests/setup-env.ts"],
    testTimeout: 180_000,
  },
});
