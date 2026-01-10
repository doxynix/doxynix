import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "src/tests/e2e",
  timeout: 30_000,
  outputDir: "src/tests/e2e/test-results",
  reporter: [["html", { outputFolder: "src/tests/e2e/playwright-report" }]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    headless: true,
    extraHTTPHeaders: {
      "x-test-client": "playwright",
    },
  },
  webServer: {
    command: "pnpm build && pnpm start",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI!,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 300 * 1000,
  },
});
