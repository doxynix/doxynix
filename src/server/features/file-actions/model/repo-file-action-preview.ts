import type { FileActionPreviewResult } from "@/server/shared/types";

import {
  formatQuickFileAuditMarkdown,
  type DocumentFilePreviewResult,
  type QuickFileAuditResult,
} from "./file-actions";
import type { SyncFileActionMeta } from "./repo-file-action-state";

function buildContextNote(result: Pick<SyncFileActionMeta, "contextDiagnostics" | "contextMeta">) {
  if (!result.contextDiagnostics.hasContext) {
    return "Generated without selected-node repository context.";
  }

  if (result.contextMeta.graphBacked) {
    if (result.contextDiagnostics.contextStrength === "strong") {
      return "Built with strong graph-backed repository context from the selected node and its neighbors.";
    }
    if (result.contextDiagnostics.contextStrength === "moderate") {
      return "Built with graph-backed repository context from the selected node and nearby structural neighbors.";
    }
    return "Built with light graph-backed node context; verify nearby files before acting on it.";
  }

  if (
    result.contextDiagnostics.contextStrength === "strong" ||
    result.contextDiagnostics.contextStrength === "moderate"
  ) {
    return "Built with node-level repository context, but without resolved graph-neighbor support.";
  }

  return "Built with limited node context; verify neighboring files manually.";
}

function buildPreviewTitle(
  baseTitle: string,
  result: Pick<SyncFileActionMeta, "contextDiagnostics" | "contextMeta">
) {
  if (result.contextMeta.graphBacked) return `${baseTitle} (graph-backed)`;
  if (result.contextDiagnostics.hasContext) return `${baseTitle} (context-aware)`;
  return `${baseTitle} (file-only)`;
}

export function toQuickFileAuditPreview(
  result: QuickFileAuditResult & SyncFileActionMeta
): FileActionPreviewResult {
  const contextNote = buildContextNote(result);

  return {
    action: "quick-file-audit",
    analysisRef: result.analysisRef,
    confidence: result.confidence,
    consistency: result.consistency,
    consistencyNote: result.consistencyNote,
    content: `> ${contextNote}\n\n${formatQuickFileAuditMarkdown(result)}`,
    contextDiagnostics: result.contextDiagnostics,
    contextMeta: result.contextMeta,
    path: result.path,
    summary: `${result.summary} ${contextNote}`,
    title: buildPreviewTitle("Quick file audit", result),
  };
}

export function toDocumentFilePreview(
  result: DocumentFilePreviewResult & SyncFileActionMeta
): FileActionPreviewResult {
  const contextNote = buildContextNote(result);

  return {
    action: "document-file-preview",
    analysisRef: result.analysisRef,
    confidence: result.confidence,
    consistency: result.consistency,
    consistencyNote: result.consistencyNote,
    content: result.documentation,
    contextDiagnostics: result.contextDiagnostics,
    contextMeta: result.contextMeta,
    path: result.path,
    summary: `${result.summary} ${contextNote}`,
    title: buildPreviewTitle("Documentation preview", result),
  };
}
