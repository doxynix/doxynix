import { join, normalize } from "pathe"; // Исправили: убрали type и импортировали join вместе с normalize

import type { RepoWithLatestAnalysisAndDocs } from "../analysis.repository";
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

  if (!normalizedCandidate.startsWith(`${normalizedParent}/`)) return null;

  const relative = normalizedCandidate.slice(normalizedParent.length + 1);
  const parts = relative.split("/").filter(Boolean);
  const head = parts[0];

  if (head == null) return null;

  // Безопасно собираем результирующий путь через join из pathe
  const scopePath = join(normalizedParent, head);
  return {
    nodeType: parts.length > 1 ? ("group" as const) : ("file" as const),
    path: scopePath,
  };
}
