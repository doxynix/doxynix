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

vi.mock("@/server/core/realtime", () => ({
  realtimeService: { user: vi.fn(() => ({ publish: vi.fn() })) },
}));

vi.mock("@/server/core/db", () => ({ prisma: {} }));

describe("calculateCodeMetrics error branch", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("should fallback to line counting when sloc parser throws", async () => {
    const { calculateCodeMetrics } = await import(
      "@/server/modules/analysis/engine/metrics/common-metrics"
    );
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
