import { describe, expect, it } from "vitest";

import { analysisPrFixesRouter } from "./analysis-pr-fixes.router";

/**
 * DXNX-237: the sub-router split must not change the client-visible surface.
 * This is the cheapest possible guard - it only reads the exported key set, so
 * it stays fast and needs no tRPC context.
 */
const EXPECTED = [
  "applyFix",
  "clearStaging",
  "configureRepository",
  "createFix",
  "getById",
  "getByRepository",
  "getRepoConfig",
  "getStagedFiles",
  "openPullRequest",
  "stageFile",
  "stageGeneratedFix",
  "unstageFile",
];

describe("analysisPrFixesRouter", () => {
  it("exposes exactly the fix and staging procedures", () => {
    expect(Object.keys(analysisPrFixesRouter).sort()).toEqual(EXPECTED);
  });

  it("has no duplicate procedure names", () => {
    const keys = Object.keys(analysisPrFixesRouter);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("keeps the four staging procedures together", () => {
    const keys = Object.keys(analysisPrFixesRouter);

    for (const name of ["clearStaging", "getStagedFiles", "stageFile", "unstageFile"]) {
      expect(keys).toContain(name);
    }
  });
});
