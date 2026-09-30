import type { AnalysisRefView } from "@doxynix/shared";

// Shapes of the values cached in Redis per user; lives here next to its only non-slice consumer, `server/core/redis.ts`.
export type FileActionPreviewResult = {
  action: "document-file-preview" | "quick-file-audit";
  // Set by `analyze-file.task.ts`; `contentRef` was never a key of the cached blob, which is why `pinAuditToDocs` read `undefined` and every pinned document landed as `version: "manual"` with no analysis link.
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
