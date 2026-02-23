import { defineConfig } from "@playwright/test";

import { IS_CI } from "./src/shared/constants/env.client";

export default defineConfig({
  outputDir: "src/tests/e2e/test-results",
  reporter: [["html", { outputFolder: "src/tests/e2e/playwright-report" }]],
  testDir: "src/tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:3000",
    extraHTTPHeaders: {
      "x-test-client": "playwright",
    },
    headless: true,
  },
  webServer: {
    command: "pnpm build && pnpm start",
    reuseExistingServer: !IS_CI,
    stderr: "pipe",
    stdout: "pipe",
    timeout: 300 * 1000,
    url: "http://127.0.0.1:3000",
  },
});
