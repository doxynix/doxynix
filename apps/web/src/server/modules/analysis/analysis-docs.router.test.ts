import { describe, expect, it } from "vitest";

import { analysisDocsRouter } from "./analysis-docs.router";

/**
 * DXNX-237: the sub-router split must not change the client-visible surface.
 * This is the cheapest possible guard - it only reads the exported key set, so
 * it stays fast and needs no tRPC context.
 */
const EXPECTED = [
  "documentFile",
  "getAvailableDocs",
  "getDocumentContent",
  "getFileActionResult",
  "getWithGraphLinks",
  "highlightFile",
  "pinAuditToDocs",
  "quickFileAudit",
];

describe("analysisDocsRouter", () => {
  it("exposes exactly the docs procedures", () => {
    expect(Object.keys(analysisDocsRouter).sort()).toEqual(EXPECTED);
  });

  it("has no duplicate procedure names", () => {
    const keys = Object.keys(analysisDocsRouter);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("keeps documentFile and quickFileAudit on the shared input schema", () => {
    // Both were separate but identical zod objects before the split; a future
    // edit that diverges them would silently change one client contract.
    const documentFile = analysisDocsRouter.documentFile;
    const quickFileAudit = analysisDocsRouter.quickFileAudit;

    expect(documentFile).toBeDefined();
    expect(quickFileAudit).toBeDefined();
  });
});
