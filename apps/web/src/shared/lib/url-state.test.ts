import { describe, expect, it } from "vitest";

import { hasActiveFilters } from "./url-state";

describe("hasActiveFilters", () => {
  it("reports no filters when every value is null", () => {
    expect(hasActiveFilters({ from: null, model: null, search: null, to: null })).toBe(false);
  });

  it("reports no filters for an empty object", () => {
    expect(hasActiveFilters({})).toBe(false);
  });

  it("treats empty and whitespace-only strings as inactive", () => {
    expect(hasActiveFilters({ search: "" })).toBe(false);
    expect(hasActiveFilters({ search: "   " })).toBe(false);
  });

  it("ignores paging keys so a page change never lights up the reset button", () => {
    expect(hasActiveFilters({ limit: 50, page: 3 })).toBe(false);
    expect(hasActiveFilters({ page: 3, search: "" })).toBe(false);
  });

  it("counts a value that differs from its default", () => {
    expect(hasActiveFilters({ sortBy: "createdAt" }, { sortBy: "updatedAt" })).toBe(true);
  });

  it("keeps a value at its default inactive", () => {
    expect(hasActiveFilters({ sortBy: "updatedAt" }, { sortBy: "updatedAt" })).toBe(false);
  });

  it("counts false as an explicit filter, which is how the banned flag works", () => {
    expect(hasActiveFilters({ banned: false })).toBe(true);
  });

  it("counts zero and other non-string values as active", () => {
    expect(hasActiveFilters({ minRiskScore: 0 })).toBe(true);
    expect(hasActiveFilters({ from: new Date("2026-01-01") })).toBe(true);
  });
});
