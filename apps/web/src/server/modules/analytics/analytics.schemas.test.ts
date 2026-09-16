import { describe, expect, it } from "vitest";

import { AnalyticsInputSchema, DashboardStatsSchema, TrendsSchema } from "./analytics.schemas";

const validActivity = {
  createdAt: new Date("2026-03-01T10:00:00Z"),
  id: "550e8400-e29b-41d4-a716-446655440000",
  progress: 85,
  repoName: "acme",
  repoOwner: "acme-corp",
  status: "DONE",
};

const validDashboardStats = {
  analysisStats: { failed: 1, new: 2, pending: 3, success: 4, total: 10 },
  highlights: {
    mostCritical: { name: "repo-a", score: 42 },
    topPerformer: { name: "repo-b", score: 95 },
  },
  languages: [{ color: "#3178c6", name: "TypeScript", value: 80 }],
  overview: {
    avgScores: { complexity: 30, health: 75, onboarding: 60, security: 80, techDebt: 25 },
    complexityDelta: -2,
    criticalRepoCount: 1,
    docsCount: 5,
    healthDelta: 3,
    onboardingDelta: 1,
    repoCount: 12,
    securityDelta: 5,
    techDebtDelta: -1,
    totalLoc: 50_000,
  },
  recentActivity: [validActivity],
  risks: {
    busFactorRepos: 2,
    topCoupling: [{ commits: 10, from_path: "a.ts", repo_name: "acme", to_path: "b.ts" }],
    topHotspots: [{ path: "src/core.ts", repo_name: "acme", score: 90 }],
  },
};

describe("DashboardStatsSchema", () => {
  it("parses a valid full object", () => {
    const result = DashboardStatsSchema.parse(validDashboardStats);
    expect(result).toEqual(validDashboardStats);
  });

  it("rejects when analysisStats.failed is a string", () => {
    const invalid = {
      ...validDashboardStats,
      analysisStats: { ...validDashboardStats.analysisStats, failed: "oops" },
    };
    expect(DashboardStatsSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects when recentActivity id is not a UUID", () => {
    const invalid = {
      ...validDashboardStats,
      recentActivity: [{ ...validActivity, id: "not-a-uuid" }],
    };
    expect(DashboardStatsSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects when recentActivity status is invalid", () => {
    const invalid = {
      ...validDashboardStats,
      recentActivity: [{ ...validActivity, status: "INVALID" }],
    };
    expect(DashboardStatsSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("TrendsSchema", () => {
  it("parses a valid array of trend points", () => {
    const data = [
      {
        complexity: 30,
        date: "Mar 1",
        fullDate: "2026-03-01",
        health: 75,
        onboarding: 60,
        security: 80,
        techDebt: 25,
      },
    ];
    expect(TrendsSchema.parse(data)).toEqual(data);
  });

  it("coerces string dates via z.coerce.date", () => {
    const raw = [
      {
        complexity: 10,
        date: "2026-01-01",
        fullDate: "2026-01-01",
        health: 50,
        onboarding: 40,
        security: 60,
        techDebt: 20,
      },
    ];
    const result = TrendsSchema.parse(raw);
    expect(result).toHaveLength(1);
  });
});

describe("AnalyticsInputSchema", () => {
  it("defaults period to '30d' when omitted", () => {
    const result = AnalyticsInputSchema.parse({});
    expect(result.period).toBe("30d");
  });

  it("accepts optional from and to dates", () => {
    const from = new Date("2026-01-01");
    const to = new Date("2026-03-01");
    const result = AnalyticsInputSchema.parse({ from, period: "custom", to });
    expect(result.from).toEqual(from);
    expect(result.to).toEqual(to);
  });
});
