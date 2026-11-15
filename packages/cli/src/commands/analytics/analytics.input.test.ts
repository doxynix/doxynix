import { afterEach, describe, expect, it, vi } from "vitest";

import { buildAnalyticsInput, buildTrendsInput } from "./analytics.input";

const AT = "2026-01-01T00:00:00Z";

describe("buildAnalyticsInput", () => {
  it("returns an empty input when no filters are given", () => {
    expect(buildAnalyticsInput({})).toEqual({ input: {}, ok: true });
  });

  it("carries repoId when a repository was resolved", () => {
    expect(buildAnalyticsInput({}, "repo-1")).toEqual({ input: { repoId: "repo-1" }, ok: true });
  });

  it("parses a valid --from into a Date", () => {
    const result = buildAnalyticsInput({ from: AT });

    expect(result.ok).toBe(true);
    expect(result).toHaveProperty("input.from", new Date(AT));
  });

  it("parses --from and --to into distinct Date fields", () => {
    const result = buildAnalyticsInput({
      from: "2026-01-01T00:00:00Z",
      to: "2026-02-01T00:00:00Z",
    });

    expect(result).toHaveProperty("input.from", new Date("2026-01-01T00:00:00Z"));
    expect(result).toHaveProperty("input.to", new Date("2026-02-01T00:00:00Z"));
  });

  it("rejects an unparseable --from and names the flag", () => {
    const result = buildAnalyticsInput({ from: "not-a-date" });

    expect(result.ok).toBe(false);
    expect(result).toHaveProperty("message", expect.stringContaining("--from"));
    expect(result).toHaveProperty("message", expect.stringContaining("not-a-date"));
  });

  it("rejects an unparseable --to and names the flag", () => {
    const result = buildAnalyticsInput({ to: "nope" });

    expect(result.ok).toBe(false);
    expect(result).toHaveProperty("message", expect.stringContaining("--to"));
  });

  it("rejects a range where --from is later than --to", () => {
    const result = buildAnalyticsInput({
      from: "2026-02-01T00:00:00Z",
      to: "2026-01-01T00:00:00Z",
    });

    expect(result.ok).toBe(false);
    expect(result).toHaveProperty("message", expect.stringContaining("Invalid date range"));
  });

  it("accepts a range where --from equals --to", () => {
    expect(buildAnalyticsInput({ from: AT, to: AT }).ok).toBe(true);
  });

  it("accepts a well-ordered range", () => {
    expect(
      buildAnalyticsInput({ from: "2026-01-01T00:00:00Z", to: "2026-02-01T00:00:00Z" }).ok,
    ).toBe(true);
  });
});

describe("date range flags reach the server", () => {
  it("marks the period custom when --from is supplied", () => {
    const result = buildAnalyticsInput({ from: "2026-10-01" });

    expect(result.ok).toBe(true);
    expect(result).toHaveProperty("input.period", "custom");
    expect(result).toHaveProperty("input.from", new Date("2026-10-01"));
  });

  it("marks the period custom when only --to is supplied", () => {
    expect(buildAnalyticsInput({ to: "2026-10-02" })).toHaveProperty("input.period", "custom");
  });

  it("leaves the period alone when neither flag is supplied", () => {
    expect(buildAnalyticsInput({})).not.toHaveProperty("input.period");
  });
});

describe("one-sided flags are completed before they reach the schema", () => {
  afterEach(() => vi.useRealTimers());

  it("fills --from from a lone --to, because a custom period needs both bounds", () => {
    const result = buildAnalyticsInput({ to: "2026-10-02" });

    expect(result).toHaveProperty("input.from", new Date("2026-09-02"));
    expect(result).toHaveProperty("input.to", new Date("2026-10-02"));
  });

  it("fills --to from now when only --from is supplied", () => {
    vi.useFakeTimers();
    vi.setSystemTime(AT);
    const result = buildAnalyticsInput({ from: "2026-01-01" });

    expect(result).toHaveProperty("input.from", new Date("2026-01-01"));
    expect(result).toHaveProperty("input.to", new Date(AT));
  });

  it("clamps a range longer than 366 days to the server cap", () => {
    const to = new Date("2026-01-01");
    const result = buildAnalyticsInput({ from: "2020-01-01", to: "2026-01-01" });

    expect(result).toHaveProperty("input.to", to);
    expect(result).toHaveProperty("input.from", new Date(to.getTime() - 365 * 86_400_000));
  });

  it("clamps a lone --from that is older than the cap", () => {
    vi.useFakeTimers();
    vi.setSystemTime(AT);
    const result = buildAnalyticsInput({ from: "2020-01-01" });

    expect(result).toHaveProperty("input.to", new Date(AT));
    expect(result).toHaveProperty(
      "input.from",
      new Date(new Date(AT).getTime() - 365 * 86_400_000),
    );
  });
});

describe("buildTrendsInput", () => {
  it("returns an empty input when no filters are given", () => {
    expect(buildTrendsInput({})).toEqual({ input: {}, ok: true });
  });

  it("carries repoId", () => {
    expect(buildTrendsInput({}, "repo-9")).toEqual({ input: { repoId: "repo-9" }, ok: true });
  });

  it("parses a valid --to into a Date", () => {
    expect(buildTrendsInput({ to: AT })).toHaveProperty("input.to", new Date(AT));
  });

  it("fills --from when only --to is given, so the custom period is valid", () => {
    expect(buildTrendsInput({ to: "2026-10-02" })).toEqual({
      input: {
        from: new Date("2026-09-02"),
        period: "custom",
        to: new Date("2026-10-02"),
      },
      ok: true,
    });
  });

  it("rejects an unparseable date instead of silently dropping it", () => {
    expect(buildTrendsInput({ to: "garbage" }).ok).toBe(false);
  });
});
