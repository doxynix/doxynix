import { afterEach, describe, expect, it, vi } from "vitest";

describe("calculateCodeMetrics error branch", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("sloc");
  });

  it("should fallback to line counting when sloc parser throws", async () => {
    const slocMock = vi.fn(() => {
      throw new Error("sloc parse failed");
    });

    vi.doMock("sloc", () => ({
      default: Object.assign(slocMock, {
        extensions: ["ts"],
      }),
    }));

    const { calculateCodeMetrics } = await import("@/server/utils/metrics");
    const metrics = calculateCodeMetrics([
      {
        content: "line1\nline2\nline3",
        path: "src/index.ts",
      },
    ]);

    expect(metrics.totalLoc).toBe(3);
    expect(metrics.languages[0]?.lines).toBe(3);
  });
});
