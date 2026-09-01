import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: {
      "server-only": "node:events",
    },
  },
  test: {
    coverage: {
      exclude: [
        "**/*.d.ts",
        "**/*.test.ts",
        "**/*.test.tsx",
        "src/tests/**/*",
        "src/shared/api-contracts/**/*",
        "src/app/**/*",
      ],

      include: [
        "src/server/modules/**/*.ts",
        "src/server/core/**/*.ts",
        "src/server/utils/**/*.ts",
        "src/shared/lib/**/*.ts",
      ],
      provider: "v8",
      reporter: ["text", "json", "html", "json-summary"],
    },
    environment: "node",

    fileParallelism: false,
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./src/tests/setup-env.ts"],
    testTimeout: 15_000,
  },
});
