import { describe, expect, it } from "vitest";

import { analysisCoreRouter } from "./analysis-core.router";

/**
 * DXNX-237: the sub-router split must not change the client-visible surface.
 * This is the cheapest possible guard - it only reads the exported key set, so
 * it stays fast and needs no tRPC context.
 */
const EXPECTED = [
  "analyze",
  "cancel",
  "getDetailedMetrics",
  "getHistory",
  "getLatest",
  "getWorkspace",
];

describe("analysisCoreRouter", () => {
  it("exposes exactly the core procedures", () => {
    expect(Object.keys(analysisCoreRouter).sort()).toEqual(EXPECTED);
  });

  it("has no duplicate procedure names", () => {
    const keys = Object.keys(analysisCoreRouter);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("exports no procedures beyond the expected set", () => {
    expect(Object.keys(analysisCoreRouter)).not.toContain("getComments");
  });
});
