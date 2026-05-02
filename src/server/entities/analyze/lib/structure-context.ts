import type { AIResult } from "@/server/shared/engine/core/analysis-result.schemas";
import { normalizeRepoPath } from "@/server/shared/engine/core/common";
import type { RepoMetrics } from "@/server/shared/engine/core/metrics.types";
import { ProjectPolicy } from "@/server/shared/engine/core/project-policy";
import type { RepoWithLatestAnalysisAndDocs } from "@/server/shared/infrastructure/repo-snapshots";
import { unique } from "@/server/shared/lib/array-utils";
import { hasText } from "@/server/shared/lib/string-utils";

import { createStructuralContextEdges } from "./edge-builder";
import { coerceAnalysisPayload } from "./payload";
import {
  buildGroupKeySet,
  collectSemanticKinds,
  filterMeaningfulEntrypoints,
  isLikelyBarrelPath,
  shouldKeepStructurePath,
} from "./semantics";
import { collectScopedEntrySignals } from "./signals";
import {
  createEmptyGroupEntry,
  isPathInsideScope,
  makeStructureNodeId,
  type StructureContext,
  type StructureGroupEntry,
  type StructureNodeType,
} from "./structure-shared";

export function buildBreadcrumbs(nodeType: StructureNodeType, path: string) {
  const parts = normalizeRepoPath(path).split("/").filter(Boolean);
  if (parts.length === 0) return [];

  const breadcrumbs = parts.slice(0, -1).map((_, index) => {
    const crumbPath = parts.slice(0, index + 1).join("/");
    return {
      id: makeStructureNodeId("group", crumbPath),
      label: ProjectPolicy.getGroupLabel(crumbPath),
      nodeType: "group" as const,
      path: crumbPath,
    };
  });

  if (nodeType === "group") {
    return [
      ...breadcrumbs,
      {
        id: makeStructureNodeId("group", path),
        label: ProjectPolicy.getGroupLabel(path),
        nodeType: "group" as const,
        path,
      },
    ];
  }

  return [
    ...breadcrumbs,
    {
      id: makeStructureNodeId("file", path),
      label: path.split("/").findLast(Boolean) ?? path,
      nodeType: "file" as const,
      path,
    },
  ];
}

export function collectNodeScopePaths(
  context: StructureContext,
  nodeType: StructureNodeType,
  path: string
) {
  if (nodeType === "file") {
    const normalizedPath = normalizeRepoPath(path);
    return context.allInterestingPaths.includes(normalizedPath) ? [normalizedPath] : [];
  }

  return context.allInterestingPaths.filter((candidatePath) =>
    isPathInsideScope(candidatePath, path)
  );
}
export function aggregateEntryForPaths(paths: string[], context: StructureContext) {
  const normalizedPaths = unique(paths.map((path) => normalizeRepoPath(path)));
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
    const normalizedEntrypointPath = normalizeRepoPath(entrypoint.path);
    if (pathSet.has(normalizedEntrypointPath)) {
      entry.entrypointDetails.push(entrypoint);
    }
  }

  for (const finding of context.aiResult.findings ?? []) {
    if (finding.evidence.some((item) => pathSet.has(normalizeRepoPath(item.path)))) {
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
function collectInterestingPaths(
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
      ...metrics.hotspotFiles,
      ...metrics.configInventory,
      ...(aiResult.findings ?? []).flatMap((finding) => finding.evidence.map((item) => item.path)),
      ...(aiResult.repository_facts ?? []).flatMap((fact) =>
        fact.evidence.map((item) => item.path)
      ),
    ]
      .filter(hasText)
      .map((path) => normalizeRepoPath(path))
  );
}
function collectStructureSignalMap(params: {
  aiResult: AIResult;
  meaningfulEntrypoints: string[];
  metrics: RepoMetrics;
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
      if (!hasText(rawPath)) continue;
      const path = normalizeRepoPath(rawPath);
      const current = map.get(path) ?? new Set();
      current.add(signal);
      map.set(path, current);
    }
  }

  add(params.meaningfulEntrypoints, "entrypoint");
  add(params.metrics.routeInventory?.sourceFiles ?? [], "api");
  add(params.metrics.documentationInput?.api.publicSurfacePaths ?? [], "api");
  add(params.metrics.hotspotFiles, "hotspot");
  add(params.metrics.configInventory, "config");
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
function buildGraphRelatedPathSet(metrics: RepoMetrics) {
  return new Set(
    (metrics.graphPreviewEdges ?? []).flatMap((edge) => [
      normalizeRepoPath(edge.fromPath),
      normalizeRepoPath(edge.toPath),
    ])
  );
}
export function buildStructureContext(
  repo: RepoWithLatestAnalysisAndDocs
): null | StructureContext {
  const payload = coerceAnalysisPayload(repo.analyses[0]);
  if (payload == null) return null;

  const { aiResult, metrics } = payload;
  const docInput = metrics.documentationInput ?? null;
  const apiPaths = buildApiPathSet(metrics);
  const graphRelatedPaths = buildGraphRelatedPathSet(metrics);
  const meaningfulEntrypoints = filterMeaningfulEntrypoints(metrics.entrypoints);
  const normalizedConfigInventory = metrics.configInventory.map((path) => normalizeRepoPath(path));
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
    const groupId = ProjectPolicy.deriveGroupId(path);
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
      !ProjectPolicy.isIgnored(item.path) &&
      !ProjectPolicy.isSensitive(item.path) &&
      !ProjectPolicy.isLowSignalConfig(item.path)
  )) {
    const normalizedEntrypointPath = normalizeRepoPath(entrypoint.path);
    const groupId = ProjectPolicy.deriveGroupId(normalizedEntrypointPath);
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
      finding.evidence.map((item) => normalizeRepoPath(item.path)),
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

function buildApiPathSet(metrics: RepoMetrics) {
  return new Set(
    unique([
      ...(metrics.routeInventory?.sourceFiles ?? []),
      ...(metrics.documentationInput?.api.publicSurfacePaths ?? []),
    ]).map((path) => normalizeRepoPath(path))
  );
}
