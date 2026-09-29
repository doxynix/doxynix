import type { AnalysisRefView } from "@doxynix/shared";

/**
 * Shapes of the values cached in Redis per user. Kept next to the only
 * non-slice consumer, `server/core/redis.ts`.
 */
export type FileActionPreviewResult = {
  action: "document-file-preview" | "quick-file-audit";
  /**
   * The analysis and commit this preview was produced against. Added by
   * `analyze-file.task.ts` on top of the preview; `contentRef` was never a key of
   * the cached blob, which is why `pinAuditToDocs` read `undefined` from it and
   * every pinned document was stored as `version: "manual"` with no analysis link.
   */
  analysisId?: string;
  commitSha?: string;
  analysisRef: AnalysisRefView | null;
  confidence: "high" | "low" | "medium";
  consistency: "matched" | "mismatch" | "unknown";
  consistencyNote: null | string;
  content: string;
  contextDiagnostics: {
    contextStrength: "light" | "moderate" | "none" | "strong";
    graphNeighborCount: number;
    hasContext: boolean;
    neighborPathCount: number;
    nextSuggestedPathCount: number;
    nonEmptyBuckets: string[];
    recommendedActionCount: number;
    sourcePathCount: number;
  };
  contextMeta: {
    confidence: "high" | "low" | "medium" | null;
    graphBacked: boolean;
    mode: "node" | "none";
    nodeId: null | string;
    source: "node-explain" | "none";
    title: null | string;
  };
  path: string;
  summary: string;
  title: string;
};

export type StagedFile = {
  content: string;
  filePath: string;
};
