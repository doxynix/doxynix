import { describe, expect, it } from "vitest";

import { analysisRepoRouter } from "./analysis-repo.router";

// Sub-router split must not change the client-visible procedure surface.
const EXPECTED = [
  "getAnalysis",
  "getByPRNumber",
  "getComments",
  "getNodeContext",
  "getStructureMap",
  "getStructureNode",
  "listByRepository",
  "postCommentToPR",
  "searchWorkspace",
];

describe("analysisRepoRouter", () => {
  it("exposes exactly the repo and PR read procedures", () => {
    expect(Object.keys(analysisRepoRouter).sort()).toEqual(EXPECTED);
  });

  it("has no duplicate procedure names", () => {
    const keys = Object.keys(analysisRepoRouter);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("exposes exactly one PR-number lookup", () => {
    const keys = Object.keys(analysisRepoRouter);

    expect(keys.filter((k) => k.toLowerCase().includes("prnumber"))).toEqual(["getByPRNumber"]);
  });
});
