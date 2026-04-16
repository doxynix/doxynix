import type { AIResult } from "@/server/shared/engine/core/analysis-result.schemas";
import { normalizeRepoPath } from "@/server/shared/engine/core/common";
import type { RepoMetrics } from "@/server/shared/engine/core/metrics.types";
import type { ProjectPolicySemanticKind } from "@/server/shared/engine/core/project-policy-rules";
import type { RepoWithLatestAnalysisAndDocs } from "@/server/shared/infrastructure/repo-snapshots";

export type WriterStatus = "failed" | "fallback" | "llm" | "missing";

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

export function createSemanticCounts(): Record<StructureSemanticKind, number> {
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
  return `${nodeType}:${normalizeRepoPath(path)}`;
}

export function parseStructureNodeId(nodeId: string): {
  nodeType: StructureNodeType;
  path: string;
} {
  if (nodeId.startsWith("group:")) {
    return { nodeType: "group", path: normalizeRepoPath(nodeId.slice("group:".length)) };
  }
  if (nodeId.startsWith("file:")) {
    return { nodeType: "file", path: normalizeRepoPath(nodeId.slice("file:".length)) };
  }
  return { nodeType: "group", path: normalizeRepoPath(nodeId) };
}

export function isPathInsideScope(path: string, scopePath: string) {
  const normalizedPath = normalizeRepoPath(path);
  const normalizedScope = normalizeRepoPath(scopePath);
  return normalizedPath === normalizedScope || normalizedPath.startsWith(`${normalizedScope}/`);
}

export function resolveImmediateChildScope(parentPath: string, candidatePath: string) {
  const normalizedParent = normalizeRepoPath(parentPath);
  const normalizedCandidate = normalizeRepoPath(candidatePath);

  if (!normalizedCandidate.startsWith(`${normalizedParent}/`)) return null;

  const relative = normalizedCandidate.slice(normalizedParent.length + 1);
  const parts = relative.split("/").filter(Boolean);
  const head = parts[0];

  const scopePath = `${normalizedParent}/${head}`;
  return {
    nodeType: parts.length > 1 ? ("group" as const) : ("file" as const),
    path: scopePath,
  };
}
