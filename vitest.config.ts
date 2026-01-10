import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],

    fileParallelism: false,
    testTimeout: 15000,

    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "json-summary"],

      include: [
        "src/server/services/**/*.ts",
        "src/server/utils/**/*.ts",
        "src/shared/lib/**/*.ts",
      ],

      exclude: [
        "**/*.d.ts",
        "**/*.test.ts",
        "src/tests/**/*",
        "src/generated/**/*",

        "src/shared/api/db/**/*",
        "src/shared/api/auth/**/*",

        "src/server/trpc/router/**/*",
        "src/shared/lib/logger.ts",
        "src/shared/lib/uploadthing.ts",
        "src/server/utils/requestContext.ts",
      ],
    },
  },
});
