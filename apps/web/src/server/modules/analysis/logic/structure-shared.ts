import { join, normalize } from "pathe";

import type { AnalysisRef, RepoWithLatestAnalysisAndDocs } from "../analysis.repository";
import type { AIResult } from "../engine/core/analysis-result.schemas";
import type { RepoMetrics } from "../engine/core/metrics.types";
import type { ProjectPolicySemanticKind } from "../engine/core/project-policy-rules";

export type WriterStatus = "failed" | "llm" | "missing";

export type StructureEdgeRelationType =
  | "api"
  | "config"
  | "cycle"
  | "entrypoint"
  | "focus"
  | "risk";

export type StructureNodeType = "file" | "group";

export type StructureSemanticKind = ProjectPolicySemanticKind;

export type StoredDocument = RepoWithLatestAnalysisAndDocs["documents"][number];

export type StructureGroupEntry = {
  apiPaths: string[];
  changeCoupling: NonNullable<RepoMetrics["changeCoupling"]>;
  churnHotspots: NonNullable<RepoMetrics["churnHotspots"]>;
  configPaths: string[];
  dependencyHotspots: NonNullable<RepoMetrics["dependencyHotspots"]>;
  entrypointDetails: NonNullable<RepoMetrics["entrypointDetails"]>;
  factTitles: string[];
  frameworkNames: string[];
  graphNeighborPaths: string[];
  graphUnresolvedSamples: NonNullable<
    NonNullable<RepoMetrics["graphReliability"]>["unresolvedSamples"]
  >;
  hotspotSignals: NonNullable<RepoMetrics["hotspotSignals"]>;
  orphanPaths: string[];
  paths: string[];
  publicSurfacePaths: string[];
  riskTitles: string[];
  semanticCounts: Record<StructureSemanticKind, number>;
};

export type StructureContext = {
  aiResult: AIResult;
  allInterestingPaths: string[];
  apiPaths: Set<string>;
  docInput: null | RepoMetrics["documentationInput"];
  groupMap: Map<string, StructureGroupEntry>;
  meaningfulEntrypoints: string[];
  metrics: RepoMetrics;
  normalizedConfigInventory: string[];
  rawTopLevelEdges: Array<{
    id: string;
    relation: StructureEdgeRelationType;
    source: string;
    target: string;
    weight: number;
  }>;
  signalMap: Map<
    string,
    Set<"api" | "config" | "entrypoint" | "fact" | "finding" | "hotspot" | "onboarding">
  >;
};

export type StructureRepositoryKind = "library" | "mixed" | "service" | "unknown";

export type StructureBreadcrumb = {
  id: string;
  label: string;
  nodeType: StructureNodeType;
  path: string;
};

export type StructureEdge = {
  id: string;
  relation: StructureEdgeRelationType;
  source: string;
  target: string;
  weight: number;
};

export type StructureNodeMarkers = {
  api: boolean;
  client: boolean;
  config: boolean;
  entrypoint: boolean;
  risk: boolean;
  server: boolean;
  shared: boolean;
};

export type StructureNodeStats = {
  apiCount: number;
  changeCouplingCount: number;
  churnCount: number;
  configCount: number;
  dependencyHotspotCount: number;
  entrypointCount: number;
  frameworkCount: number;
  graphWarningCount: number;
  hotspotCount: number;
  orphanCount: number;
  pathCount: number;
  riskCount: number;
};

export type StructureNodeSummary = {
  canDrillDeeper: boolean;
  description: string;
  id: string;
  kind: StructureSemanticKind;
  label: string;
  markers: StructureNodeMarkers;
  nodeType: StructureNodeType;
  path: string;
  previewPaths: string[];
  score: number;
  stats: StructureNodeStats;
};

export type StructureNeighborBuckets = {
  apiNeighbors: string[];
  changeRiskNeighbors: string[];
  configNeighbors: string[];
  coupledNeighbors: string[];
  entryFlowNeighbors: string[];
  entryNeighbors: string[];
  graphNeighbors: string[];
  publicSurfaceNeighbors: string[];
  relatedChildNeighbors: string[];
  riskNeighbors: string[];
};

export type StructureReviewPriority =
  | { level: "high"; reason: string }
  | { level: "low"; reason: string }
  | { level: "medium"; reason: string };

export type StructureInspectPayload = {
  apiHints: string[];
  configHints: string[];
  dependsOn: string[];
  entrypointReason: null | string;
  factTitles: string[];
  frameworkHints: string[];
  gitHints: string[];
  graphHints: string[];
  hotspotHints: string[];
  kind: string;
  neighborBuckets: StructureNeighborBuckets;
  neighborPaths: string[];
  nextSuggestedPaths: string[];
  recommendedActions: string[];
  relatedPaths: string[];
  reviewPriority: StructureReviewPriority;
  samplePaths: string[];
  title: string;
  usedBy: string[];
  whyImportant: string;
};

export type StructureNodeInspectPayload = StructureInspectPayload & {
  contains: string[];
};

// Declared in this leaf module so `analysis.mapper` never reaches back into the producers; producers annotate their returns with these aliases, so the compiler catches drift
export type StructureMapPayload = {
  analysisRef: AnalysisRef | null;
  filters: {
    api: string[];
    client: string[];
    entrypoints: string[];
    server: string[];
    shared: string[];
  };
  graph: {
    edges: Array<StructureEdge>;
    groups: Array<{ description: string; id: string; label: string }>;
    nodes: Array<StructureNodeSummary>;
  };
  inspect: {
    byNodeId: Record<string, StructureInspectPayload>;
    defaultNodeId: null | string;
  };
  overview: {
    architectureStyle: string;
    primaryEntrypoints: string[];
    primaryModules: string[];
    purpose: string;
    repositoryKind: StructureRepositoryKind;
    stack: string[];
  };
  selection: {
    defaultNodeId: null | string;
  };
};

export type StructureNodePayload = {
  analysisRef: AnalysisRef | null;
  breadcrumbs: Array<StructureBreadcrumb>;
  canDrillDeeper: boolean;
  children: Array<StructureNodeSummary>;
  edges: Array<StructureEdge>;
  inspect: StructureNodeInspectPayload;
  node: StructureNodeSummary;
};

export type NodeExplainConfidence = "high" | "low" | "medium";

export type NodeExplainNode = {
  id: string;
  kind: StructureSemanticKind;
  label: string;
  nodeType: StructureNodeType;
  path: string;
};

export type NodeExplainRelationships = {
  apiHints: string[];
  apiSurface: boolean;
  breadcrumbs: Array<StructureBreadcrumb>;
  contains: string[];
  dependsOn: string[];
  entrypoint: boolean;
  entrypointReason: null | string;
  factTitles: string[];
  frameworkHints: string[];
  gitHints: string[];
  graphHints: string[];
  hotspotHints: string[];
  neighborBuckets: StructureNeighborBuckets;
  neighborPaths: string[];
  recommendedActions: string[];
  relatedPaths: string[];
  reviewPriority: StructureReviewPriority;
  riskTitles: string[];
  usedBy: string[];
};

export type NodeExplainPayload = {
  analysisRef: AnalysisRef | null;
  confidence: NodeExplainConfidence;
  nextSuggestedPaths: string[];
  node: NodeExplainNode;
  relationships: NodeExplainRelationships;
  role: string;
  sourcePaths: string[];
  summary: string[];
  whyImportant: string;
};

function createSemanticCounts(): Record<StructureSemanticKind, number> {
  return {
    api: 0,
    backend: 0,
    config: 0,
    core: 0,
    data: 0,
    frontend: 0,
    infrastructure: 0,
    ml: 0,
    mobile: 0,
    shared: 0,
    unknown: 0,
  };
}

export function createEmptyGroupEntry(): StructureGroupEntry {
  return {
    apiPaths: [],
    changeCoupling: [],
    churnHotspots: [],
    configPaths: [],
    dependencyHotspots: [],
    entrypointDetails: [],
    factTitles: [],
    frameworkNames: [],
    graphNeighborPaths: [],
    graphUnresolvedSamples: [],
    hotspotSignals: [],
    orphanPaths: [],
    paths: [],
    publicSurfacePaths: [],
    riskTitles: [],
    semanticCounts: createSemanticCounts(),
  };
}

export function makeStructureNodeId(nodeType: StructureNodeType, path: string) {
  return `${nodeType}:${normalize(path)}`;
}

export function parseStructureNodeId(nodeId: string): {
  nodeType: StructureNodeType;
  path: string;
} {
  if (nodeId.startsWith("group:")) {
    return { nodeType: "group", path: normalize(nodeId.slice("group:".length)) };
  }
  if (nodeId.startsWith("file:")) {
    return { nodeType: "file", path: normalize(nodeId.slice("file:".length)) };
  }
  return { nodeType: "group", path: normalize(nodeId) };
}

export function isPathInsideScope(path: string, scopePath: string) {
  const normalizedPath = normalize(path);
  const normalizedScope = normalize(scopePath);
  return normalizedPath === normalizedScope || normalizedPath.startsWith(`${normalizedScope}/`);
}

export function resolveImmediateChildScope(parentPath: string, candidatePath: string) {
  const normalizedParent = normalize(parentPath);
  const normalizedCandidate = normalize(candidatePath);

  if (!normalizedCandidate.startsWith(`${normalizedParent}/`)) {
    return null;
  }

  const relative = normalizedCandidate.slice(normalizedParent.length + 1);
  const parts = relative.split("/").filter(Boolean);
  const head = parts[0];

  if (head == null) {
    return null;
  }

  const scopePath = join(normalizedParent, head);
  return {
    nodeType: parts.length > 1 ? ("group" as const) : ("file" as const),
    path: scopePath,
  };
}
