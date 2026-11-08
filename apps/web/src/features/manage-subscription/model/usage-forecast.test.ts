import { describe, expect, it } from "vitest";

import { buildUsageForecast } from "./usage-forecast";

const DAY_MS = 86_400_000;

function periodOf(month: number, year = 2026) {
  return {
    periodEnd: new Date(Date.UTC(year, month, 1)),
    periodStart: new Date(Date.UTC(year, month - 1, 1)),
  };
}

describe("buildUsageForecast", () => {
  it("projects a linear pace and finds the day the limit is hit", () => {
    const { periodStart, periodEnd } = periodOf(11); // November: 30 days
    const now = new Date(periodStart.getTime() + 11.5 * DAY_MS); // ~day 12
    const forecast = buildUsageForecast({
      limit: 100,
      now,
      periodEnd,
      periodStart,
      series: [],
      used: 58,
    });

    expect(forecast.daysTotal).toBe(30);
    expect(forecast.daysElapsed).toBe(12);
    expect(forecast.percent).toBe(58);
    expect(forecast.projectedPercent).toBeCloseTo((58 / 11.5) * 30, 5);
    expect(forecast.hitDay).toBe(Math.ceil(100 / (58 / 11.5)));
    expect(forecast.severity).toBe("normal");
    expect(forecast.projectedSeverity).toBe("critical");
    expect(forecast.axisMaxPercent).toBeGreaterThanOrEqual(forecast.projectedPercent);
  });

  it("grows the axis for any projection instead of capping it", () => {
    const { periodStart, periodEnd } = periodOf(11);
    const now = new Date(periodStart.getTime() + 4.5 * DAY_MS);
    const forecast = buildUsageForecast({
      limit: 100,
      now,
      periodEnd,
      periodStart,
      series: [],
      used: 311,
    });

    expect(forecast.percent).toBe(311);
    expect(forecast.axisMaxPercent).toBeGreaterThanOrEqual(311);
    expect(Number.isFinite(forecast.axisMaxPercent)).toBe(true);
  });

  it("survives absurd projections without overflowing the axis", () => {
    const { periodStart, periodEnd } = periodOf(11);
    const now = new Date(periodStart.getTime() + 1.5 * DAY_MS);
    const forecast = buildUsageForecast({
      limit: 1,
      now,
      periodEnd,
      periodStart,
      series: [],
      used: 1_924_891_249_821,
    });

    expect(Number.isFinite(forecast.projectedPercent)).toBe(true);
    expect(forecast.axisMaxPercent).toBeGreaterThanOrEqual(forecast.projectedPercent);
  });

  it("turns near-limit usage amber and exhausted usage red", () => {
    const { periodStart, periodEnd } = periodOf(11);
    const now = new Date(periodStart.getTime() + 27.5 * DAY_MS);

    const warning = buildUsageForecast({
      limit: 100,
      now,
      periodEnd,
      periodStart,
      series: [],
      used: 75,
    });
    const critical = buildUsageForecast({
      limit: 100,
      now,
      periodEnd,
      periodStart,
      series: [],
      used: 95,
    });

    expect(warning.projectedPercent).toBeLessThan(100);
    expect(warning.severity).toBe("warning");
    expect(critical.severity).toBe("critical");
  });

  it("publishes no forecast before a full day has elapsed", () => {
    const { periodStart, periodEnd } = periodOf(11);
    const now = new Date(periodStart.getTime() + 0.3 * DAY_MS);
    const forecast = buildUsageForecast({
      limit: 100,
      now,
      periodEnd,
      periodStart,
      series: [],
      used: 5,
    });

    expect(forecast.projectable).toBe(false);
    expect(forecast.projectedPercent).toBe(5);
    expect(forecast.hitDay).toBeNull();
    expect(forecast.chartRows.at(-1)?.forecast).toBe(5);
  });

  it("raises the projected severity from the pace once a baseline exists", () => {
    const { periodStart, periodEnd } = periodOf(11);
    const now = new Date(periodStart.getTime() + 5.2 * DAY_MS);
    const forecast = buildUsageForecast({
      limit: 100,
      now,
      periodEnd,
      periodStart,
      series: [],
      used: 30,
    });

    expect(forecast.projectable).toBe(true);
    expect(forecast.projectedPercent).toBeGreaterThan(100);
    expect(forecast.severity).toBe("normal");
    expect(forecast.projectedSeverity).toBe("critical");
  });

  it("does not raise the projected severity from the projection in the first days", () => {
    const { periodStart, periodEnd } = periodOf(11);
    const now = new Date(periodStart.getTime() + 1.5 * DAY_MS);
    const forecast = buildUsageForecast({
      limit: 100,
      now,
      periodEnd,
      periodStart,
      series: [],
      used: 20,
    });

    expect(forecast.projectedPercent).toBeGreaterThan(100);
    expect(forecast.severity).toBe("normal");
    expect(forecast.projectedSeverity).toBe("normal");
  });

  it("keeps the actual percentage neutral when only the projection is critical", () => {
    const { periodStart, periodEnd } = periodOf(11);
    const now = new Date(periodStart.getTime() + 6.8 * DAY_MS);
    const forecast = buildUsageForecast({
      limit: 20_000_000,
      now,
      periodEnd,
      periodStart,
      series: [],
      used: 4_700_000,
    });

    expect(forecast.percent).toBeCloseTo(23.5, 5);
    expect(forecast.severity).toBe("normal");
    expect(forecast.projectedPercent).toBeGreaterThan(100);
    expect(forecast.projectedSeverity).toBe("critical");
  });

  it("leaves unlimited plans without a hit day", () => {
    const { periodStart, periodEnd } = periodOf(11);
    const now = new Date(periodStart.getTime() + 9.5 * DAY_MS);
    const forecast = buildUsageForecast({
      limit: null,
      now,
      periodEnd,
      periodStart,
      series: [],
      used: 10_000,
    });

    expect(forecast.percent).toBe(0);
    expect(forecast.hitDay).toBeNull();
    expect(forecast.severity).toBe("normal");
  });

  it("builds a cumulative actual line from the daily series", () => {
    const { periodStart, periodEnd } = periodOf(11); // November: 30 days
    const now = new Date(periodStart.getTime() + 2.5 * DAY_MS);
    const series = [
      { date: "2026-11-01", value: 10 },
      { date: "2026-11-02", value: 5 },
      { date: "2026-11-03", value: 7 },
    ];
    const forecast = buildUsageForecast({
      limit: 100,
      now,
      periodEnd,
      periodStart,
      series,
      used: 22,
    });

    expect(forecast.daysElapsed).toBe(3);
    expect(forecast.chartRows[0]?.actual).toBe(10);
    expect(forecast.chartRows[1]?.actual).toBe(15);
    expect(forecast.chartRows[2]?.actual).toBe(22);
    expect(forecast.chartRows[3]?.actual).toBeNull();
    expect(forecast.chartRows.at(-1)?.forecast).toBeCloseTo(forecast.projectedPercent, 8);
  });

  it("keeps the last actual point on the authoritative rollup value", () => {
    const { periodStart, periodEnd } = periodOf(11);
    const now = new Date(periodStart.getTime() + 2.5 * DAY_MS);
    const forecast = buildUsageForecast({
      limit: 100,
      now,
      periodEnd,
      periodStart,
      series: [{ date: "2026-11-01", value: 3 }],
      used: 9,
    });

    expect(forecast.chartRows[2]?.actual).toBe(9);
  });
});
