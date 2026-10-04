import { readFileSync } from "node:fs";

import { join } from "pathe";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(import.meta.dirname, "..", "sentry.server.config.ts"), "utf8");

describe("sentry.server.config", () => {
  it("does not pass options removed in Sentry v11", () => {
    expect(source).not.toContain("enableLogs");
  });

  it("stays prod-only and samples traces", () => {
    expect(source).toContain("enabled: IS_PROD");
    expect(source).toContain("tracesSampleRate: 0.1");
  });

  it("does not attach stack-frame local variables", () => {
    expect(source).not.toContain("includeLocalVariables: true");
  });
});
