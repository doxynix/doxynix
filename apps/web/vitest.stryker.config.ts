import { mergeConfig } from "vitest/config";

import baseConfig from "./vitest.config";

export default mergeConfig(baseConfig, {
  test: {
    exclude: ["src/tests/integration/**/*", "src/tests/e2e/**/*", "node_modules/**/*"],
    fileParallelism: false,
    include: ["src/tests/unit/**/*.test.{ts,tsx}"],
  },
});
