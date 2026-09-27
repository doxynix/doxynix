import { describe, expect, it, vi } from "vitest";

import { analyticsMapper, type RecentActivityRecord, type TrendRecord } from "./analytics.mapper";
import { DashboardStatsSchema, TrendsSchema } from "./analytics.schemas";

const UUID_A = "018f0000-0000-7000-8000-0000000000a1";

describe("analyticsMapper.toRecentActivity", () => {
  function makeActivity(overrides?: Partial<RecentActivityRecord>): RecentActivityRecord {
    return {
      createdAt: "2026-03-01T12:00:00.000Z",
      id: UUID_A,
      progress: 100,
      repoName: "doxynix",
      repoOwner: "karen",
      status: "DONE",
      ...overrides,
    };
  }

  it("projects exactly the DashboardStats.recentActivity fields", () => {
    const result = analyticsMapper.toRecentActivity(makeActivity());

    expect(Object.keys(result).sort()).toStrictEqual(
      Object.keys(DashboardStatsSchema.shape.recentActivity.element.shape).sort(),
    );
  });

  it("coerces the jsonb timestamp string to a Date", () => {
    const result = analyticsMapper.toRecentActivity(makeActivity());

    expect(result.createdAt).toStrictEqual(new Date("2026-03-01T12:00:00.000Z"));
    expect(DashboardStatsSchema.shape.recentActivity.safeParse([result]).success).toBe(true);
  });

  it("keeps zero progress rather than dropping it", () => {
    expect(analyticsMapper.toRecentActivity(makeActivity({ progress: 0 })).progress).toBe(0);
  });
});

describe("analyticsMapper.toTrend", () => {
  function makeTrend(overrides?: Partial<TrendRecord>): TrendRecord {
    return {
      complexity: 10,
      dateKey: new Date("2026-03-01T12:00:00Z"),
      fullDate: "2026-03-01",
      health: 90,
      onboarding: 70,
      security: 80,
      techDebt: 20,
      ...overrides,
    };
  }

  it("splits the date key into a UTC label and a sortable fullDate", () => {
    expect(analyticsMapper.toTrend(makeTrend())).toStrictEqual({
      complexity: 10,
      date: "Mar 1",
      fullDate: "2026-03-01",
      health: 90,
      onboarding: 70,
      security: 80,
      techDebt: 20,
    });
  });

  it("formats the day in UTC, not in the server's local zone", () => {
    const row = analyticsMapper.toTrend(makeTrend({ dateKey: new Date("2026-06-30T23:30:00Z") }));

    expect(row.date).toBe("Jun 30");
    expect(row.fullDate).toBe("2026-06-30");
  });

  it("defaults every null aggregate to 0", () => {
    const row = analyticsMapper.toTrend(
      makeTrend({
        complexity: null,
        dateKey: new Date("2026-01-05T00:00:00Z"),
        health: null,
        onboarding: null,
        security: null,
        techDebt: null,
      }),
    );

    expect(row).toStrictEqual({
      complexity: 0,
      date: "Jan 5",
      fullDate: "2026-01-05",
      health: 0,
      onboarding: 0,
      security: 0,
      techDebt: 0,
    });
  });

  it("falls back to now when dateKey is null", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T12:00:00Z"));
    try {
      expect(analyticsMapper.toTrend(makeTrend({ dateKey: null }))).toStrictEqual({
        complexity: 10,
        date: "Mar 1",
        fullDate: "2026-03-01",
        health: 90,
        onboarding: 70,
        security: 80,
        techDebt: 20,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("passes the Trends .output() schema", () => {
    expect(TrendsSchema.safeParse([analyticsMapper.toTrend(makeTrend())]).success).toBe(true);
  });
});
