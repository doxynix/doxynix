import { createAnalyzeContextBuilder } from "@/server/entities/analyze/lib/analyze-context-builder";
import type { DbClient } from "@/server/shared/infrastructure/db";
import { getRepoWithLatestAnalysisAndDocs } from "@/server/shared/infrastructure/repo-snapshots";

import type { FileActionNodeContext } from "./file-actions";

export type NodeContext = Omit<
  FileActionNodeContext,
  "graphNeighbors" | "neighborPaths" | "nextSuggestedPaths" | "recommendedActions" | "sourcePaths"
> & {
  graphNeighbors: string[];
  neighborPaths: string[];
  nextSuggestedPaths: string[];
  nodeId: string;
  recommendedActions: string[];
  sourcePaths: string[];
};

export type NodeContextMeta = {
  confidence: "high" | "low" | "medium" | null;
  graphBacked: boolean;
  mode: "node" | "none";
  nodeId: null | string;
  source: "node-explain" | "none";
  title: null | string;
};

export type NodeContextDiagnostics = {
  contextStrength: "light" | "moderate" | "none" | "strong";
  graphNeighborCount: number;
  hasContext: boolean;
  neighborPathCount: number;
  nextSuggestedPathCount: number;
  nonEmptyBuckets: string[];
  recommendedActionCount: number;
  sourcePathCount: number;
};

export async function buildNodeContext(
  db: DbClient,
  repoId: string,
  nodeId?: string
): Promise<NodeContext | null> {
  if (nodeId == null) return null;

  const repo = await getRepoWithLatestAnalysisAndDocs(db, repoId);
  if (repo == null) return null;

  const explain = createAnalyzeContextBuilder(repo).getNodeExplain(nodeId);
  if (explain == null) return null;

  return {
    confidence: explain.confidence,
    graphNeighbors: explain.relationships.neighborBuckets.graphNeighbors,
    neighborBuckets: explain.relationships.neighborBuckets,
    neighborPaths: explain.relationships.neighborPaths,
    nextSuggestedPaths: explain.nextSuggestedPaths,
    nodeId: explain.node.id,
    recommendedActions: explain.relationships.recommendedActions,
    reviewPriority: explain.relationships.reviewPriority,
    role: explain.role,
    sourcePaths: explain.sourcePaths,
    summary: explain.summary,
    title: explain.node.label,
    whyImportant: explain.whyImportant,
  };
}

export function buildNodeContextMeta(nodeContext: NodeContext | null): NodeContextMeta {
  if (nodeContext == null) {
    return {
      confidence: null,
      graphBacked: false,
      mode: "none",
      nodeId: null,
      source: "none",
      title: null,
    };
  }

  return {
    confidence: nodeContext.confidence,
    graphBacked: nodeContext.graphNeighbors.length > 0,
    mode: "node",
    nodeId: nodeContext.nodeId,
    source: "node-explain",
    title: nodeContext.title,
  };
}

export function buildNodeContextDiagnostics(
  nodeContext: NodeContext | null
): NodeContextDiagnostics {
  if (nodeContext == null) {
    return {
      contextStrength: "none",
      graphNeighborCount: 0,
      hasContext: false,
      neighborPathCount: 0,
      nextSuggestedPathCount: 0,
      nonEmptyBuckets: [],
      recommendedActionCount: 0,
      sourcePathCount: 0,
    };
  }

  const nonEmptyBuckets = Object.entries(nodeContext.neighborBuckets ?? {})
    .filter(([, paths]) => paths.length > 0)
    .map(([bucket]) => bucket);

  const weightedSignalCount =
    nodeContext.sourcePaths.length +
    nodeContext.graphNeighbors.length +
    nodeContext.neighborPaths.length +
    nodeContext.nextSuggestedPaths.length +
    nodeContext.recommendedActions.length +
    nonEmptyBuckets.length;

  const contextStrength =
    weightedSignalCount >= 12
      ? ("strong" as const)
      : weightedSignalCount >= 7
        ? ("moderate" as const)
        : ("light" as const);

  return {
    contextStrength,
    graphNeighborCount: nodeContext.graphNeighbors.length,
    hasContext: true,
    neighborPathCount: nodeContext.neighborPaths.length,
    nextSuggestedPathCount: nodeContext.nextSuggestedPaths.length,
    nonEmptyBuckets,
    recommendedActionCount: nodeContext.recommendedActions.length,
    sourcePathCount: nodeContext.sourcePaths.length,
  };
}
