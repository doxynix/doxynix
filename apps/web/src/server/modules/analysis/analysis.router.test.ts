import { describe, expect, it } from "vitest";

import { analysisRouter } from "./analysis.router";
import { analysisCoreRouter } from "./analysis-core.router";
import { analysisDocsRouter } from "./analysis-docs.router";
import { analysisPrFixesRouter } from "./analysis-pr-fixes.router";
import { analysisRepoRouter } from "./analysis-repo.router";

/**
 * DXNX-237: the contract the typed client depends on. The frontend calls
 * `trpc.analysis.<name>`, so the composed router must stay a FLAT map of the
 * same 36 procedures. If someone nests the sub-routers instead of spreading
 * them, every client call breaks at compile time - this test catches it first.
 */
const ALL_PROCEDURES = [
  "analyze",
  "applyFix",
  "cancel",
  "clearStaging",
  "configureRepository",
  "createFix",
  "documentFile",
  "getAnalysis",
  "getAvailableDocs",
  "getById",
  "getByPRNumber",
  "getByRepository",
  "getComments",
  "getDetailedMetrics",
  "getDocumentContent",
  "getFileActionResult",
  "getHistory",
  "getImpactByPRNumber",
  "getLatest",
  "getNodeContext",
  "getRepoConfig",
  "getStagedFiles",
  "getStructureMap",
  "getStructureNode",
  "getWithGraphLinks",
  "getWorkspace",
  "highlightFile",
  "listByRepository",
  "openPullRequest",
  "pinAuditToDocs",
  "postCommentToPR",
  "quickFileAudit",
  "searchWorkspace",
  "stageFile",
  "stageGeneratedFix",
  "unstageFile",
];

/** Members tRPC attaches to a composed router; not procedures. */
const TRPC_MEMBERS = ["_def", "createCaller"];

const proceduresOf = (router: object): string[] =>
  Object.keys(router)
    .filter((key) => !TRPC_MEMBERS.includes(key))
    .sort();

describe("analysisRouter", () => {
  it("exposes exactly the 36 procedures the client calls", () => {
    expect(proceduresOf(analysisRouter)).toEqual(ALL_PROCEDURES);
  });

  it("carries no tRPC internals beyond the expected two", () => {
    // A composed tRPC router attaches its own members. If an upgrade adds one,
    // this fails so the test above is re-read rather than silently widened.
    expect(
      Object.keys(analysisRouter)
        .filter((key) => !ALL_PROCEDURES.includes(key))
        .sort(),
    ).toEqual([...TRPC_MEMBERS].sort());
  });

  it("stays flat rather than nested under a sub-router namespace", () => {
    const keys = Object.keys(analysisRouter).filter((key) => !TRPC_MEMBERS.includes(key));

    for (const key of keys) {
      expect(ALL_PROCEDURES).toContain(key);
    }
  });

  it("is the union of the four sub-routers with no procedure lost or shadowed", () => {
    const union = [
      ...Object.keys(analysisCoreRouter),
      ...Object.keys(analysisDocsRouter),
      ...Object.keys(analysisPrFixesRouter),
      ...Object.keys(analysisRepoRouter),
    ];

    expect(union.sort()).toEqual(ALL_PROCEDURES);
    expect(new Set(union).size).toBe(union.length);
  });

  it("registers the router under the flat `analysis` key in the app router", async () => {
    const { appRouter } = await import("@/server/modules");

    expect(Object.keys(appRouter)).toContain("analysis");
    // The app router re-creates the procedures, so this is the exact surface the
    // typed client sees - no tRPC internals at all.
    expect(Object.keys(appRouter.analysis).sort()).toEqual(ALL_PROCEDURES);
  });
});
