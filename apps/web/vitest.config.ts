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
    environment: "node",
    globals: true,
    setupFiles: ["./src/tests/setup-env.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],

    fileParallelism: false,
    testTimeout: 15000,

    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "json-summary"],

      include: [
        "src/server/modules/**/*.ts",
        "src/server/core/**/*.ts",
        "src/server/utils/**/*.ts",
        "src/shared/lib/**/*.ts",
      ],

      exclude: [
        "**/*.d.ts",
        "**/*.test.ts",
        "**/*.test.tsx",
        "src/tests/**/*",
        "src/shared/api-contracts/**/*",
        "src/app/**/*",
      ],
    },
  },
});
