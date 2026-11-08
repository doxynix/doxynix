import { describe, expect, it } from "vitest";

import type { DashboardStats } from "@/widgets/dashboard/model/dashboard.types";

import { patchAnalysisProgress } from "./analysis-progress";

const stats = {
  recentActivity: [
    { id: "a", progress: 10, status: "PENDING" },
    { id: "b", progress: 50, status: "PENDING" },
  ],
} as unknown as DashboardStats;

describe("patchAnalysisProgress", () => {
  it("updates only the matching activity", () => {
    const next = patchAnalysisProgress(stats, {
      analysisId: "a",
      progress: 100,
      status: "DONE",
    });

    expect(next?.recentActivity[0]).toMatchObject({ progress: 100, status: "DONE" });
    expect(next?.recentActivity[1]).toMatchObject({ progress: 50, status: "PENDING" });
  });

  it("keeps the rest of the payload untouched", () => {
    expect(patchAnalysisProgress(stats, { analysisId: "a", progress: 1, status: "DONE" })).not.toBe(
      stats,
    );
  });

  it("passes through missing stats", () => {
    expect(
      patchAnalysisProgress(undefined, { analysisId: "a", progress: 1, status: "DONE" }),
    ).toBeUndefined();
  });
});
