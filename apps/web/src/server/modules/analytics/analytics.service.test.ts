import { describe, expect, it } from "vitest";

import type { DbClient } from "@/server/core/db";

import { analyticsService } from "./analytics.service";

const BASE = new Date("2026-03-01T12:00:00Z");

describe("analyticsService.calculatePeriodStart", () => {
  it("subtracts 15 minutes for '15m'", () => {
    const result = analyticsService.calculatePeriodStart("15m", BASE);
    expect(result).toEqual(new Date("2026-03-01T11:45:00Z"));
  });

  it("subtracts 1 hour for '1h'", () => {
    const result = analyticsService.calculatePeriodStart("1h", BASE);
    expect(result).toEqual(new Date("2026-03-01T11:00:00Z"));
  });

  it("subtracts 1 day for '24h'", () => {
    const result = analyticsService.calculatePeriodStart("24h", BASE);
    expect(result).toEqual(new Date("2026-02-28T12:00:00Z"));
  });

  it("subtracts 7 days for '7d'", () => {
    const result = analyticsService.calculatePeriodStart("7d", BASE);
    expect(result).toEqual(new Date("2026-02-22T12:00:00Z"));
  });

  it("subtracts 30 days for '30d'", () => {
    const result = analyticsService.calculatePeriodStart("30d", BASE);
    expect(result).toEqual(new Date("2026-01-30T12:00:00Z"));
  });

  it("subtracts 90 days for '90d'", () => {
    const result = analyticsService.calculatePeriodStart("90d", BASE);
    expect(result).toEqual(new Date("2025-12-01T12:00:00Z"));
  });
});
/** Records the parameters the typed SQL receives, without touching a database. */
function recordingDb() {
  const calls: unknown[][] = [];
  const db = {
    $queryRawTyped: (query: { values: readonly unknown[] }) => {
      calls.push([...query.values]);
      return Promise.resolve([]);
    },
  };

  return { calls, db: db as unknown as DbClient };
}

describe("analyticsService workspace scoping", () => {
  const WORKSPACE_ID = "018f2b3c-4d5e-7f60-8123-456789abcdef";

  it("forwards the workspace id, not a user id, to getTrends", async () => {
    const { calls, db } = recordingDb();

    await analyticsService.getTrends(db, { period: "7d" }, WORKSPACE_ID);

    expect(calls[0]?.[0]).toBe(WORKSPACE_ID);
    expect(calls[0]).toHaveLength(4);
  });

  it("forwards the workspace id and the custom window to getDashboardStats", async () => {
    const { calls, db } = recordingDb();
    const from = new Date("2026-02-01T00:00:00Z");
    const to = new Date("2026-02-11T00:00:00Z");

    await analyticsService.getDashboardStats(db, { from, period: "custom", to }, WORKSPACE_ID);

    const [workspaceId, currentStart, previousStart, currentEnd] = calls[0] ?? [];

    expect(workspaceId).toBe(WORKSPACE_ID);
    expect(currentStart).toEqual(from);
    expect(currentEnd).toEqual(to);
    // Same-length previous window, so the deltas compare like with like.
    expect(previousStart).toEqual(new Date("2026-01-22T00:00:00Z"));
  });

  it("never puts the previous window after the current one on a zero-length range", async () => {
    const { calls, db } = recordingDb();
    const at = new Date("2026-02-11T00:00:00Z");

    await analyticsService.getDashboardStats(
      db,
      { from: at, period: "custom", to: at },
      WORKSPACE_ID,
    );

    const [, currentStart, previousStart] = calls[0] ?? [];

    expect(previousStart).toEqual(currentStart);
  });
});
