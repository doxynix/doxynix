import { mergeConfig } from "vitest/config";

import baseConfig from "./vitest.config";

const config = mergeConfig(baseConfig, {
  test: {
    exclude: ["src/tests/integration/**/*", "src/tests/e2e/**/*", "node_modules/**/*"],
    fileParallelism: false,
    isolate: true,
  },
});

if (process.env.STRYKER_TEST_FILE) {
  config.test = {
    ...config.test,
    include: [process.env.STRYKER_TEST_FILE],
  };
}

export default config;
