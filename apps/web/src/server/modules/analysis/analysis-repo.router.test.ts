import { describe, expect, it } from "vitest";

import { analysisRepoRouter } from "./analysis-repo.router";

// Sub-router split must not change the client-visible procedure surface.
const EXPECTED = [
  "getAnalysis",
  "getByPRNumber",
  "getComments",
  "getImpactByPRNumber",
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

  it("keeps both PR-number lookups that share one service call", () => {
    // Intentionally differ: the former accepts z.string() and the latter z.uuid(); both must survive.
    const keys = Object.keys(analysisRepoRouter);

    expect(keys).toContain("getByPRNumber");
    expect(keys).toContain("getImpactByPRNumber");
  });
});
