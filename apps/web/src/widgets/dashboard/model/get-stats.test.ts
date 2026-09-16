import { describe, expect, it } from "vitest";

import type { DashboardStats } from "./dashboard.types";
import { getStats } from "./get-stats";

const identity = (key: string) => key;

const DEFAULT_OVERVIEW = {
  avgScores: { complexity: 60, health: 90, onboarding: 70, security: 80, techDebt: 55 },
  complexityDelta: 1,
  criticalRepoCount: 3,
  docsCount: 10,
  healthDelta: 2,
  onboardingDelta: -1,
  repoCount: 4,
  securityDelta: 0,
  techDebtDelta: 4,
  totalLoc: 1_234_567,
};

function stats(
  overview: Partial<DashboardStats["overview"]> = {},
  analysisStats: Partial<DashboardStats["analysisStats"]> = {},
): DashboardStats {
  return {
    analysisStats: { failed: 0, new: 0, pending: 2, success: 5, total: 7, ...analysisStats },
    overview: { ...DEFAULT_OVERVIEW, ...overview },
  } as unknown as DashboardStats;
}

describe("getStats", () => {
  it("builds the eight dashboard cards in order", () => {
    const items = getStats(stats(), identity, "en-US");

    expect(items.map((m) => m.id)).toEqual([
      "health",
      "security",
      "complexity",
      "onboarding",
      "loc",
      "techdebt",
      "queue",
      "criticalRepoCount",
    ]);
  });

  it("passes translation keys as labels", () => {
    const items = getStats(stats(), identity, "en-US");

    expect(items.map((m) => m.label)).toEqual([
      "stat_health_score",
      "stat_security",
      "stat_complexity",
      "stat_onboarding",
      "stat_total_loc",
      "stat_tech_debt",
      "stat_pending",
      "stat_critical_repo_count",
    ]);
  });

  it("formats score cards as /100 values with class names from health", () => {
    const items = getStats(stats(), identity, "en-US");

    const health = items.find((m) => m.id === "health")!;
    expect(health.value).toBe("90/100");
    expect(health.className).toBe("text-success bg-success/10");
    expect(health.delta).toBe(2);

    expect(items.find((m) => m.id === "security")?.value).toBe("80/100");
    expect(items.find((m) => m.id === "complexity")?.value).toBe("60/100");
    expect(items.find((m) => m.id === "onboarding")?.value).toBe("70/100");
    expect(items.find((m) => m.id === "techdebt")?.value).toBe("55/100");
  });

  it("maps a low health score to destructive classes", () => {
    const items = getStats(
      stats({ avgScores: { ...DEFAULT_OVERVIEW.avgScores, health: 40 } }),
      identity,
      "en-US",
    );

    expect(items.find((m) => m.id === "health")?.className).toBe(
      "text-destructive bg-destructive/10",
    );
  });

  it("flags complexity and tech debt with reverse color", () => {
    const items = getStats(stats(), identity, "en-US");

    expect(items.find((m) => m.id === "complexity")?.reverseColor).toBe(true);
    expect(items.find((m) => m.id === "techdebt")?.reverseColor).toBe(true);
    expect(items.find((m) => m.id === "health")?.reverseColor).toBeUndefined();
    expect(items.find((m) => m.id === "security")?.reverseColor).toBeUndefined();
  });

  it("spins the queue icon while analyses are pending", () => {
    const items = getStats(stats({}, { pending: 2 }), identity, "en-US");

    expect(items.find((m) => m.id === "queue")).toMatchObject({
      iconClass: "animate-spin",
      value: 2,
    });
  });

  it("keeps the queue icon static without pending analyses", () => {
    const items = getStats(stats({}, { pending: 0 }), identity, "en-US");

    expect(items.find((m) => m.id === "queue")).toMatchObject({
      iconClass: undefined,
      value: 0,
    });
  });

  it("formats total lines of code for the locale", () => {
    const enItems = getStats(stats(), identity, "en-US");
    const deItems = getStats(stats(), identity, "de-DE");

    expect(enItems.find((m) => m.id === "loc")?.value).toBe("1,234,567");
    expect(deItems.find((m) => m.id === "loc")?.value).toBe("1.234.567");
  });

  it("stringifies the critical repo count", () => {
    const items = getStats(stats(), identity, "en-US");

    expect(items.find((m) => m.id === "criticalRepoCount")?.value).toBe("3");
  });
});
