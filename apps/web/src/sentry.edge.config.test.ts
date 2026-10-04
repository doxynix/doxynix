import { readFileSync } from "node:fs";

import { join } from "pathe";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(import.meta.dirname, "..", "sentry.edge.config.ts"), "utf8");

describe("sentry.edge.config", () => {
  it("does not pass options removed in Sentry v11", () => {
    expect(source).not.toContain("enableLogs");
  });

  it("stays prod-only and samples traces", () => {
    expect(source).toContain("enabled: IS_PROD");
    expect(source).toContain("tracesSampleRate: 0.1");
  });

  it("reuses the shared data-collection policy", () => {
    expect(source).toContain("dataCollection: SENTRY_DATA_COLLECTION");
  });
});
