import { readFileSync } from "node:fs";

import { join } from "pathe";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(import.meta.dirname, "instrumentation-client.ts"), "utf8");

describe("instrumentation-client", () => {
  it("does not register replay or tracing integrations at module scope", () => {
    const initBlock = source.slice(
      source.indexOf("Sentry.init("),
      source.indexOf("onRouterTransitionStart"),
    );

    expect(initBlock).not.toContain("replayIntegration");
    expect(initBlock).not.toContain("browserTracingIntegration");
    expect(initBlock).not.toContain("httpClientIntegration");
    expect(initBlock).not.toContain("reportingObserverIntegration");
  });

  it("keeps Sentry.init eager and in prod-only mode", () => {
    expect(source).toContain("enabled: IS_PROD");
    expect(source).toMatch(/Sentry\.init\(\{/);
  });

  it("defers integrations behind an idle callback", () => {
    expect(source).toContain("addIntegration");
    expect(source).toMatch(/requestIdleCallback|setTimeout/);
  });

  it("does not pass options removed in Sentry v11", () => {
    expect(source).not.toContain("enableLogs");
  });
});
