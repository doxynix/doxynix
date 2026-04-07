import { DocType } from "@prisma/client";

import { aiSchema, type AIResult } from "@/server/features/analyze-repo/lib/schemas";
import type { RepoMetrics } from "@/server/features/analyze-repo/lib/types";
import { normalizeRepoPath as normalizePath } from "@/server/shared/engine/core/common";
import { FileClassifier } from "@/server/shared/engine/core/file-classifier";
import type {
  LatestCompletedAnalysis,
  RepoWithLatestAnalysisAndDocs,
} from "@/server/shared/infrastructure/repo-snapshots";

import { createStructuralContextEdges } from "./edge-builder";
import {
  buildGroupKeySet,
  collectSemanticKinds,
  deriveGroupId,
  filterMeaningfulEntrypoints,
  hasPath,
  isLikelyBarrelPath,
  prettifyGroupLabel,
  shouldKeepStructurePath,
  unique,
} from "./semantics";
import { collectScopedEntrySignals } from "./signals";

export function coerceAnalysisPayload(analysis: LatestCompletedAnalysis | undefined | null) {
  if (analysis == null || analysis.metricsJson == null || analysis.resultJson == null) return null;

  const parsed = aiSchema.safeParse(analysis.resultJson);
  if (!parsed.success) return null;

  return {
    aiResult: parsed.data,
    analysis,
    metrics: analysis.metricsJson as RepoMetrics,
  };
}
export function dedupeLatestDocsByType(docs: StoredDocument[]) {
  const latestByType = new Map<DocType, StoredDocument>();

  for (const doc of docs) {
    const current = latestByType.get(doc.type);
    if (current == null || doc.updatedAt > current.updatedAt) {
      latestByType.set(doc.type, doc);
    }
  }

  return Array.from(latestByType.values()).sort((left, right) => {
    const orderDiff = DOC_TYPE_ORDER[left.type] - DOC_TYPE_ORDER[right.type];
    if (orderDiff !== 0) return orderDiff;
    return right.updatedAt.getTime() - left.updatedAt.getTime();
  });
}
export function getWriterStatus(docType: DocType, aiResult: AIResult | null): WriterStatus | null {
  const writerKey = WRITER_KEY_BY_DOC_TYPE[docType];
  if (writerKey == null) return null;
  return aiResult?.analysisRuntime?.writers?.[writerKey] ?? null;
}
export function normalizeWriterStatuses(aiResult: AIResult | null) {
  return {
    api: getWriterStatus(DocType.API, aiResult),
    architecture: getWriterStatus(DocType.ARCHITECTURE, aiResult),
    changelog: getWriterStatus(DocType.CHANGELOG, aiResult),
    contributing: getWriterStatus(DocType.CONTRIBUTING, aiResult),
    readme: getWriterStatus(DocType.README, aiResult),
  };
}
export function toDocSummary(doc: StoredDocument, aiResult: AIResult | null) {
  const status = getWriterStatus(doc.type, aiResult);
  return {
    id: doc.publicId,
    isFallback: status === "fallback",
    source: status === "fallback" ? "fallback" : status === "llm" ? "llm" : null,
    status,
    type: doc.type,
    updatedAt: doc.updatedAt,
    version: doc.version,
  };
}
export const DOC_TYPE_ORDER: Record<DocType, number> = {
  [DocType.API]: 2,
  [DocType.ARCHITECTURE]: 1,
  [DocType.CHANGELOG]: 4,
  [DocType.CODE_DOC]: 5,
  [DocType.CONTRIBUTING]: 3,
  [DocType.README]: 0,
};

export const WRITER_KEY_BY_DOC_TYPE: Partial<
  Record<DocType, keyof NonNullable<NonNullable<AIResult["analysisRuntime"]>["writers"]>>
> = {
  [DocType.API]: "api",
  [DocType.ARCHITECTURE]: "architecture",
  [DocType.CHANGELOG]: "changelog",
  [DocType.CONTRIBUTING]: "contributing",
  [DocType.README]: "readme",
};
export function buildBreadcrumbs(nodeType: StructureNodeType, path: string) {
  const parts = normalizePath(path).split("/").filter(Boolean);
  if (parts.length === 0) return [];

  const breadcrumbs = parts.slice(0, -1).map((_, index) => {
    const crumbPath = parts.slice(0, index + 1).join("/");
    return {
      id: makeStructureNodeId("group", crumbPath),
      label: prettifyGroupLabel(crumbPath),
      nodeType: "group" as const,
      path: crumbPath,
    };
  });

  if (nodeType === "group") {
    return [
      ...breadcrumbs,
      {
        id: makeStructureNodeId("group", path),
        label: prettifyGroupLabel(path),
        nodeType: "group" as const,
        path,
      },
    ];
  }

  return [
    ...breadcrumbs,
    {
      id: makeStructureNodeId("file", path),
      label: path.split("/").filter(Boolean).at(-1) ?? path,
      nodeType: "file" as const,
      path,
    },
  ];
}

export function resolveImmediateChildScope(parentPath: string, candidatePath: string) {
  const normalizedParent = normalizePath(parentPath);
  const normalizedCandidate = normalizePath(candidatePath);

  if (!normalizedCandidate.startsWith(`${normalizedParent}/`)) return null;

  const relative = normalizedCandidate.slice(normalizedParent.length + 1);
  const parts = relative.split("/").filter(Boolean);
  const head = parts[0];
  if (head == null) return null;

  const scopePath = `${normalizedParent}/${head}`;
  return {
    nodeType: parts.length > 1 ? ("group" as const) : ("file" as const),
    path: scopePath,
  };
}

export function collectNodeScopePaths(
  context: StructureContext,
  nodeType: StructureNodeType,
  path: string
) {
  if (nodeType === "file") {
    const normalizedPath = normalizePath(path);
    return context.allInterestingPaths.includes(normalizedPath) ? [normalizedPath] : [];
  }

  return context.allInterestingPaths.filter((candidatePath) =>
    isPathInsideScope(candidatePath, path)
  );
}
export function aggregateEntryForPaths(paths: string[], context: StructureContext) {
  const normalizedPaths = unique(paths.map((path) => normalizePath(path)));
  const pathSet = new Set(normalizedPaths);
  const entry = createEmptyGroupEntry();

  for (const path of normalizedPaths) {
    entry.paths.push(path);
    if (context.apiPaths.has(path)) entry.apiPaths.push(path);
    if (context.normalizedConfigInventory.includes(path)) entry.configPaths.push(path);
    if ((context.docInput?.api.publicSurfacePaths ?? []).includes(path))
      entry.publicSurfacePaths.push(path);
    for (const semanticKind of collectSemanticKinds(path, context.apiPaths)) {
      entry.semanticCounts[semanticKind] += 1;
    }
  }

  for (const entrypoint of context.metrics.entrypointDetails ?? []) {
    const normalizedEntrypointPath = normalizePath(entrypoint.path);
    if (pathSet.has(normalizedEntrypointPath)) {
      entry.entrypointDetails.push(entrypoint);
    }
  }

  for (const finding of context.aiResult.findings ?? []) {
    if (finding.evidence.some((item) => pathSet.has(normalizePath(item.path)))) {
      entry.riskTitles.push(finding.title);
    }
  }

  const scopedSignals = collectScopedEntrySignals(normalizedPaths, context);
  entry.changeCoupling = scopedSignals.changeCoupling;
  entry.churnHotspots = scopedSignals.churnHotspots;
  entry.dependencyHotspots = scopedSignals.dependencyHotspots;
  entry.factTitles = scopedSignals.factTitles;
  entry.frameworkNames = scopedSignals.frameworkNames;
  entry.graphNeighborPaths = scopedSignals.graphNeighborPaths;
  entry.graphUnresolvedSamples = scopedSignals.graphUnresolvedSamples;
  entry.hotspotSignals = scopedSignals.hotspotSignals;
  entry.orphanPaths = scopedSignals.orphanPaths;

  return entry;
}
export function collectInterestingPaths(
  aiResult: AIResult,
  metrics: RepoMetrics,
  meaningfulEntrypoints: string[]
) {
  const docInput = metrics.documentationInput ?? null;
  return unique(
    [
      ...(docInput?.architecture.modules.map((module) => module.path) ?? []),
      ...meaningfulEntrypoints,
      ...(docInput?.sections.overview.body.primaryModules ?? []),
      ...(docInput?.sections.onboarding.body.firstLookPaths ?? []),
      ...(docInput?.sections.onboarding.body.apiPaths ?? []),
      ...(docInput?.sections.onboarding.body.configPaths ?? []),
      ...(docInput?.sections.onboarding.body.riskPaths ?? []),
      ...(metrics.routeInventory?.sourceFiles ?? []),
      ...(docInput?.api.publicSurfacePaths ?? []),
      ...(metrics.hotspotFiles ?? []),
      ...(metrics.configInventory ?? []),
      ...(aiResult.findings ?? []).flatMap((finding) => finding.evidence.map((item) => item.path)),
      ...(aiResult.repository_facts ?? []).flatMap((fact) =>
        fact.evidence.map((item) => item.path)
      ),
    ]
      .filter(hasPath)
      .map((path) => normalizePath(path))
  );
}
export function collectStructureSignalMap(params: {
  aiResult: AIResult;
  metrics: RepoMetrics;
  meaningfulEntrypoints: string[];
}) {
  const map = new Map<
    string,
    Set<"api" | "config" | "entrypoint" | "fact" | "finding" | "hotspot" | "onboarding">
  >();

  function add(
    paths: string[],
    signal: "api" | "config" | "entrypoint" | "fact" | "finding" | "hotspot" | "onboarding"
  ) {
    for (const rawPath of paths) {
      if (!hasPath(rawPath)) continue;
      const path = normalizePath(rawPath);
      const current = map.get(path) ?? new Set();
      current.add(signal);
      map.set(path, current);
    }
  }

  add(params.meaningfulEntrypoints, "entrypoint");
  add(params.metrics.routeInventory?.sourceFiles ?? [], "api");
  add(params.metrics.documentationInput?.api.publicSurfacePaths ?? [], "api");
  add(params.metrics.hotspotFiles ?? [], "hotspot");
  add(params.metrics.configInventory ?? [], "config");
  add(
    params.metrics.documentationInput?.sections.onboarding.body.firstLookPaths ?? [],
    "onboarding"
  );
  add(params.metrics.documentationInput?.sections.onboarding.body.apiPaths ?? [], "onboarding");
  add(params.metrics.documentationInput?.sections.onboarding.body.configPaths ?? [], "onboarding");
  add(params.metrics.documentationInput?.sections.onboarding.body.riskPaths ?? [], "onboarding");
  add(
    (params.aiResult.findings ?? []).flatMap((finding) =>
      finding.evidence.map((item) => item.path)
    ),
    "finding"
  );
  add(
    (params.aiResult.repository_facts ?? []).flatMap((fact) =>
      fact.evidence.map((item) => item.path)
    ),
    "fact"
  );

  return map;
}
export function buildGraphRelatedPathSet(metrics: RepoMetrics) {
  return new Set(
    (metrics.graphPreviewEdges ?? []).flatMap((edge) => [
      normalizePath(edge.fromPath),
      normalizePath(edge.toPath),
    ])
  );
}
export function buildStructureContext(
  repo: RepoWithLatestAnalysisAndDocs
): StructureContext | null {
  const payload = coerceAnalysisPayload(repo.analyses[0]);
  if (payload == null) return null;

  const { aiResult, metrics } = payload;
  const docInput = metrics.documentationInput ?? null;
  const apiPaths = buildApiPathSet(metrics);
  const graphRelatedPaths = buildGraphRelatedPathSet(metrics);
  const meaningfulEntrypoints = filterMeaningfulEntrypoints(metrics.entrypoints);
  const normalizedConfigInventory = metrics.configInventory.map((path) => normalizePath(path));
  const signalMap = collectStructureSignalMap({ aiResult, meaningfulEntrypoints, metrics });
  const allInterestingPaths = collectInterestingPaths(
    aiResult,
    metrics,
    meaningfulEntrypoints
  ).filter((path) =>
    shouldKeepStructurePath(path, signalMap, metrics, apiPaths, graphRelatedPaths)
  );

  const groupMap = new Map<string, StructureGroupEntry>();

  for (const path of allInterestingPaths) {
    const groupId = deriveGroupId(path);
    const current = groupMap.get(groupId) ?? createEmptyGroupEntry();
    current.paths.push(path);
    if (apiPaths.has(path)) current.apiPaths.push(path);
    if (normalizedConfigInventory.includes(path)) current.configPaths.push(path);
    if ((docInput?.api.publicSurfacePaths ?? []).includes(path))
      current.publicSurfacePaths.push(path);
    for (const semanticKind of collectSemanticKinds(path, apiPaths)) {
      current.semanticCounts[semanticKind] += 1;
    }
    groupMap.set(groupId, current);
  }

  for (const entrypoint of (metrics.entrypointDetails ?? []).filter(
    (item) =>
      !isLikelyBarrelPath(item.path) &&
      !FileClassifier.isIgnored(item.path) &&
      !FileClassifier.isSensitiveFile(item.path) &&
      !FileClassifier.isLowSignalConfigFile(item.path)
  )) {
    const normalizedEntrypointPath = normalizePath(entrypoint.path);
    const groupId = deriveGroupId(normalizedEntrypointPath);
    const current = groupMap.get(groupId) ?? createEmptyGroupEntry();
    current.entrypointDetails.push(entrypoint);
    current.paths.push(normalizedEntrypointPath);
    for (const semanticKind of collectSemanticKinds(normalizedEntrypointPath, apiPaths)) {
      current.semanticCounts[semanticKind] += 1;
    }
    groupMap.set(groupId, current);
  }

  for (const finding of aiResult.findings ?? []) {
    const findingGroups = buildGroupKeySet(
      finding.evidence.map((item) => normalizePath(item.path)),
      apiPaths
    );
    for (const groupId of findingGroups) {
      const current = groupMap.get(groupId) ?? createEmptyGroupEntry();
      current.riskTitles.push(finding.title);
      groupMap.set(groupId, current);
    }
  }

  for (const [groupId, current] of groupMap) {
    const scopedSignals = collectScopedEntrySignals(current.paths, {
      aiResult,
      metrics,
    });
    current.dependencyHotspots = scopedSignals.dependencyHotspots;
    current.factTitles = scopedSignals.factTitles;
    current.frameworkNames = scopedSignals.frameworkNames;
    current.graphNeighborPaths = scopedSignals.graphNeighborPaths;
    current.graphUnresolvedSamples = scopedSignals.graphUnresolvedSamples;
    current.hotspotSignals = scopedSignals.hotspotSignals;
    current.orphanPaths = scopedSignals.orphanPaths;
    groupMap.set(groupId, current);
  }

  return {
    aiResult,
    allInterestingPaths,
    apiPaths,
    docInput,
    groupMap,
    meaningfulEntrypoints,
    metrics,
    normalizedConfigInventory,
    rawTopLevelEdges: createStructuralContextEdges({ aiResult, apiPaths, groupMap, metrics }),
    signalMap,
  };
}
export function hasText(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}
export type WriterStatus = "failed" | "fallback" | "llm" | "missing";
export type StructureEdgeRelationType =
  | "api"
  | "config"
  | "cycle"
  | "entrypoint"
  | "focus"
  | "risk";
export type StructureNodeType = "file" | "group";
export type StructureSemanticKind =
  | "api"
  | "backend"
  | "config"
  | "core"
  | "data"
  | "frontend"
  | "infrastructure"
  | "shared"
  | "unknown";

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
  docInput: RepoMetrics["documentationInput"] | null;
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
export function buildApiPathSet(metrics: RepoMetrics) {
  return new Set(
    unique([
      ...(metrics.routeInventory?.sourceFiles ?? []),
      ...(metrics.documentationInput?.api.publicSurfacePaths ?? []),
    ]).map((path) => normalizePath(path))
  );
}

export function createSemanticCounts(): Record<StructureSemanticKind, number> {
  return {
    api: 0,
    backend: 0,
    config: 0,
    core: 0,
    data: 0,
    frontend: 0,
    infrastructure: 0,
    shared: 0,
    unknown: 0,
  };
}

export function makeStructureNodeId(nodeType: StructureNodeType, path: string) {
  return `${nodeType}:${normalizePath(path)}`;
}

export function parseStructureNodeId(nodeId: string): {
  nodeType: StructureNodeType;
  path: string;
} {
  if (nodeId.startsWith("group:")) {
    return { nodeType: "group", path: normalizePath(nodeId.slice("group:".length)) };
  }
  if (nodeId.startsWith("file:")) {
    return { nodeType: "file", path: normalizePath(nodeId.slice("file:".length)) };
  }
  return { nodeType: "group", path: normalizePath(nodeId) };
}

export function isPathInsideScope(path: string, scopePath: string) {
  const normalizedPath = normalizePath(path);
  const normalizedScope = normalizePath(scopePath);
  return normalizedPath === normalizedScope || normalizedPath.startsWith(`${normalizedScope}/`);
}
