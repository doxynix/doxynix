import { describe, expect, it } from "vitest";

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

  it("subtracts 90 days for '90d'", () => {
    const result = analyticsService.calculatePeriodStart("90d", BASE);
    expect(result).toEqual(new Date("2025-12-01T12:00:00Z"));
  });

  it("defaults to 30 days for 'custom'", () => {
    const result = analyticsService.calculatePeriodStart("custom", BASE);
    expect(result).toEqual(new Date("2026-01-30T12:00:00Z"));
  });

  it("defaults to 30 days for an unknown period string", () => {
    const result = analyticsService.calculatePeriodStart("unknown", BASE);
    expect(result).toEqual(new Date("2026-01-30T12:00:00Z"));
  });
});
