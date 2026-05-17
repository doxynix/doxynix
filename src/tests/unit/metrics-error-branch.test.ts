import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("colors/safe", () => ({
  default: { enabled: false, strip: (s: string) => s },
}));

vi.mock("@/server/modules/analysis/engine/metrics/duplication-metrics", () => ({
  calculateRepositoryDuplication: vi.fn().mockResolvedValue({
    clones: [],
    duplicationPercentage: 0,
  }),
}));

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

    const { calculateCodeMetrics } =
      await import("@/server/modules/analysis/engine/metrics/common-metrics");
    const metrics = await calculateCodeMetrics([
      {
        content: "line1\nline2\nline3",
        path: "src/index.ts",
      },
    ]);

    expect(metrics.totalLoc).toBe(3);
    expect(metrics.languages[0]?.lines).toBe(3);
  });
});
