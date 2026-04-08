import type { AnalysisRef } from "@/server/shared/infrastructure/repo-snapshots";

import type { NodeContextDiagnostics, NodeContextMeta } from "./repo-node-context";

export type ContentRefInput = {
  analysisId?: string;
  commitSha?: string;
};

export type SyncFileActionMeta = {
  analysisRef: AnalysisRef | null;
  consistency: "matched" | "mismatch" | "unknown";
  consistencyNote: string | null;
  contentRef: ContentRefInput;
  contextDiagnostics: NodeContextDiagnostics;
  contextMeta: NodeContextMeta;
};

export function buildConsistencyState(
  analysisRef: AnalysisRef | null,
  contentRef: ContentRefInput
): {
  consistency: "matched" | "mismatch" | "unknown";
  consistencyNote: string | null;
} {
  if (analysisRef == null) {
    return {
      consistency: "unknown",
      consistencyNote: "No completed analysis snapshot is available for this repository yet.",
    };
  }

  if (contentRef.analysisId == null && contentRef.commitSha == null) {
    return {
      consistency: "unknown",
      consistencyNote:
        "The file action was run without an explicit analysis reference, so snapshot consistency is unknown.",
    };
  }

  const analysisIdMatches =
    contentRef.analysisId == null || contentRef.analysisId === analysisRef.analysisId;
  const commitShaMatches =
    contentRef.commitSha == null || contentRef.commitSha === analysisRef.commitSha;

  if (analysisIdMatches && commitShaMatches) {
    return {
      consistency: "matched",
      consistencyNote: "The file action matches the latest completed analysis snapshot.",
    };
  }

  return {
    consistency: "mismatch",
    consistencyNote:
      "The file action was run against file content that does not match the latest completed analysis snapshot.",
  };
}

export function buildSyncFileActionMeta(params: {
  analysisRef: AnalysisRef | null;
  contentRef: ContentRefInput;
  contextDiagnostics: NodeContextDiagnostics;
  contextMeta: NodeContextMeta;
}) {
  const consistency = buildConsistencyState(params.analysisRef, params.contentRef);

  return {
    analysisRef: params.analysisRef,
    consistency: consistency.consistency,
    consistencyNote: consistency.consistencyNote,
    contentRef: params.contentRef,
    contextDiagnostics: params.contextDiagnostics,
    contextMeta: params.contextMeta,
  } satisfies SyncFileActionMeta;
}
