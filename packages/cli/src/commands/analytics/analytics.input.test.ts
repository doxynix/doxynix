import { describe, expect, it } from "vitest";

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

  it("rejects an unparseable date instead of silently dropping it", () => {
    expect(buildTrendsInput({ to: "garbage" }).ok).toBe(false);
  });
});
