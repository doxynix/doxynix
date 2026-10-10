import { describe, expect, it } from "vitest";

import { formatHealthStatus } from "./system.formatter";

describe("system formatter", () => {
  it("formats an online health status as success", () => {
    expect(formatHealthStatus("ok")).toContain("Online");
    expect(formatHealthStatus("ok")).toContain("OK");
  });

  it("keeps non-ok health statuses visible", () => {
    expect(formatHealthStatus("degraded")).toContain("degraded");
  });
});
