import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "server-only": "node:events",
    },
    tsconfigPaths: true,
  },
  test: {
    coverage: {
      exclude: [
        "**/*.d.ts",
        "**/*.types.ts",
        "**/types.ts",
        "**/*.test.ts",
        "**/*.test.tsx",
        "src/tests/**/*",

        "src/shared/ui/**",
        "**/page.tsx",
        "**/layout.tsx",
        "**/loading.tsx",
        "**/error.tsx",
        "**/not-found.tsx",
        "**/global-error.tsx",
        "**/forbidden.tsx",
        "**/unauthorized.tsx",
        "**/opengraph-image.tsx",

        "**/manifest.ts",
        "**/robots.ts",
        "**/sitemap.ts",
        "src/instrumentation.ts",
        "src/instrumentation-client.ts",

        "src/app/api/auth/**",
        "src/app/api/trpc/**",
        "src/app/api/docs/**",
        "src/app/api/openapi/**",

        "**/*.store.ts",
        "**/*parser*.ts",
        "**/*-parsers.ts",

        "**/*config*.ts",
        "**/*-config.ts",
        "src/server/core/trpc/constants.ts",
        "src/entities/repo/model/metrics.ts",
        "src/entities/repo/model/repo-visibility.ts",
        "src/entities/repo/model/editor-extensions.ts",

        "src/shared/i18n/**",
        "src/shared/api/**",
        "src/server/core/posthog-server.ts",

        "src/server/modules/index.ts",
      ],

      include: ["src/**/*.ts"],
      provider: "v8",
      reporter: ["text", "json", "html", "json-summary"],
    },
    environment: "node",
    exclude: ["src/tests/integration/**/*", "src/tests/e2e/**/*", "node_modules/**/*"],
    globals: true,
    include: ["prisma/**/*.{test,spec}.ts", "src/**/*.{test,spec}.ts"],
    setupFiles: ["./src/tests/setup-env.ts"],
    testTimeout: 15_000,
  },
});
