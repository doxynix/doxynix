import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    coverage: {
      exclude: [
        "**/*.d.ts",
        "**/*.types.ts",
        "**/*.test.ts",
        "**/types.ts",
        "**/*.command.ts",
        "**/*.service.ts",
        "src/index.ts",
        "src/core/repo.api.ts",
        "src/core/client.ts",
      ],
      include: ["src/**/*.ts"],
      provider: "v8",
      reporter: ["text", "json-summary", "json"],
    },
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
    testTimeout: 15_000,
  },
});
