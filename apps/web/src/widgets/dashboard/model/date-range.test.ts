import { subDays, subMinutes } from "date-fns";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clampCustomRange,
  hasUrlStateChanged,
  normalizeCustomRange,
  resolveDateRange,
} from "./date-range";

const NOW = new Date("2026-09-14T12:00:00Z");

const PERIODS = [
  {
    getValue: () => ({ from: subMinutes(new Date(), 15), to: new Date() }),
    key: "15m",
  },
  {
    getValue: () => ({ from: subDays(new Date(), 30), to: new Date() }),
    key: "30d",
  },
] as const;

describe("resolveDateRange", () => {
  afterEach(() => vi.useRealTimers());

  it("returns the explicit range when from and to are present", () => {
    const from = new Date("2026-09-01T00:00:00Z");
    const to = new Date("2026-09-10T00:00:00Z");
    expect(resolveDateRange(from, to, "custom", PERIODS)).toEqual({ from, to });
  });

  it("keeps a half-picked custom range without inventing an end", () => {
    const from = new Date("2026-09-01T00:00:00Z");
    expect(resolveDateRange(from, null, "custom", PERIODS)).toEqual({ from, to: undefined });
  });

  it("returns the preset window for a preset even when from/to are in the URL", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const from = new Date("2026-01-01T00:00:00Z");
    const to = new Date("2026-01-10T00:00:00Z");

    expect(resolveDateRange(from, to, "15m", PERIODS)).toEqual({
      from: subMinutes(NOW, 15),
      to: NOW,
    });
  });

  it("resolves a preset period when from/to are missing", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    expect(resolveDateRange(null, null, "15m", PERIODS)).toEqual({
      from: subMinutes(NOW, 15),
      to: NOW,
    });
  });

  it("returns undefined for an unknown period and no range", () => {
    expect(resolveDateRange(null, null, "nope", PERIODS)).toBeUndefined();
  });
});

describe("clampCustomRange", () => {
  const TO = new Date("2026-09-14T00:00:00Z");

  it("leaves a range inside the cap untouched", () => {
    const from = subDays(TO, 30);
    expect(clampCustomRange(from, TO)).toEqual({ from, to: TO });
  });

  it("moves from to 365 days before to when the span is longer", () => {
    const from = subDays(TO, 400);

    expect(clampCustomRange(from, TO)).toEqual({
      from: new Date(TO.getTime() - 365 * 86_400_000),
      to: TO,
    });
  });
});

describe("normalizeCustomRange", () => {
  afterEach(() => vi.useRealTimers());

  const TO = new Date("2026-09-14T00:00:00Z");

  it("returns null for a range the schema accepts", () => {
    expect(normalizeCustomRange(subDays(TO, 7), TO)).toBeNull();
  });

  it("fills a missing from from the given to", () => {
    expect(normalizeCustomRange(null, TO)).toEqual({ from: subDays(TO, 30), to: TO });
  });

  it("fills a missing from from now when to is missing too", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    expect(normalizeCustomRange(null, null)).toEqual({ from: subDays(NOW, 30), to: NOW });
  });

  it("clamps an over-long range against the server cap", () => {
    const from = subDays(TO, 400);

    expect(normalizeCustomRange(from, TO)).toEqual({
      from: new Date(TO.getTime() - 365 * 86_400_000),
      to: TO,
    });
  });
});

describe("hasUrlStateChanged", () => {
  it("detects a change in from", () => {
    const prev = { from: new Date("2026-09-01T00:00:00Z"), period: "custom", to: null };
    const next = { from: new Date("2026-09-02T00:00:00Z"), period: "custom", to: null };
    expect(hasUrlStateChanged(prev, next)).toBe(true);
  });

  it("detects a change from null to a set to date", () => {
    const prev = { from: null, period: "30d", to: null };
    const next = { from: null, period: "30d", to: new Date("2026-09-14T00:00:00Z") };
    expect(hasUrlStateChanged(prev, next)).toBe(true);
  });

  it("detects period changes", () => {
    const prev = { from: null, period: "15m", to: null };
    const next = { from: null, period: "30d", to: null };
    expect(hasUrlStateChanged(prev, next)).toBe(true);
  });

  it("detects no change for equal states", () => {
    const state = {
      from: new Date("2026-09-01T00:00:00Z"),
      period: "custom",
      to: new Date("2026-09-02T00:00:00Z"),
    };
    expect(hasUrlStateChanged(state, state)).toBe(false);
  });

  it("treats null and undefined as the same missing date", () => {
    const prev = { from: null, period: "custom", to: null };
    const next = { from: undefined as unknown as Date | null, period: "custom", to: null };
    expect(hasUrlStateChanged(prev, next)).toBe(false);
  });
});
