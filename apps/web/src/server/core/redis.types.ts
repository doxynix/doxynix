import type { AnalysisRefView } from "@doxynix/shared";

/**
 * Shapes of the values cached in Redis per user. Kept next to the only
 * non-slice consumer, `server/core/redis.ts`.
 */
export type FileActionPreviewResult = {
  action: "document-file-preview" | "quick-file-audit";
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
