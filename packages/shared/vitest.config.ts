import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: ["**/*.d.ts", "**/*.types.ts", "**/*.test.ts", "src/index.ts"],
      include: ["src/**/*.ts"],
      provider: "v8",
      reporter: ["text", "json-summary", "json"],
    },
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
    testTimeout: 15_000,
  },
});
