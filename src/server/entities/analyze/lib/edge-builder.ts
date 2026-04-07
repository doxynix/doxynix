import type { AIResult } from "@/server/features/analyze-repo/lib/schemas";
import type { RepoMetrics } from "@/server/features/analyze-repo/lib/types";
import { normalizeRepoPath as normalizePath } from "@/server/shared/engine/core/common";
import { FileClassifier } from "@/server/shared/engine/core/file-classifier";

import {
  makeStructureNodeId,
  resolveImmediateChildScope,
  StructureContext,
  StructureEdgeRelationType,
  StructureGroupEntry,
} from "./analysis-utils";
import { buildStructureNodeSummary } from "./graph-navigator";
import {
  buildGroupKeySet,
  collectGroupsByKind,
  deriveGroupId,
  filterMeaningfulEntrypoints,
  getStrongGroups,
  unique,
} from "./semantics";

export function addWeightedEdge(
  edges: Map<
    string,
    { relation: StructureEdgeRelationType; source: string; target: string; weight: number }
  >,
  source: string,
  target: string,
  relation: StructureEdgeRelationType,
  weight = 1
) {
  if (source === target) return;
  const key = `${source}:${target}:${relation}`;
  const current = edges.get(key);
  if (current == null) {
    edges.set(key, { relation, source, target, weight });
    return;
  }
  current.weight += weight;
}
export function connectGroupSet(
  edges: Map<
    string,
    { relation: StructureEdgeRelationType; source: string; target: string; weight: number }
  >,
  groups: string[],
  relation: StructureEdgeRelationType,
  weight = 1
) {
  for (let index = 0; index < groups.length; index += 1) {
    const source = groups[index];
    if (source == null) continue;
    for (let inner = index + 1; inner < groups.length; inner += 1) {
      const target = groups[inner];
      if (target == null) continue;
      addWeightedEdge(edges, source, target, relation, weight);
      addWeightedEdge(edges, target, source, relation, weight);
    }
  }
}
export function addGraphPreviewEdges(params: {
  apiPaths: Set<string>;
  edges: Map<
    string,
    { relation: StructureEdgeRelationType; source: string; target: string; weight: number }
  >;
  metrics: RepoMetrics;
}) {
  for (const edge of params.metrics.graphPreviewEdges ?? []) {
    const sourcePath = normalizePath(edge.fromPath);
    const targetPath = normalizePath(edge.toPath);

    if (sourcePath === targetPath) continue;
    if (FileClassifier.isSensitiveFile(sourcePath) || FileClassifier.isSensitiveFile(targetPath)) {
      continue;
    }
    if (FileClassifier.isIgnored(sourcePath) || FileClassifier.isIgnored(targetPath)) continue;

    const sourceGroup = deriveGroupId(sourcePath);
    const targetGroup = deriveGroupId(targetPath);
    if (sourceGroup === targetGroup) continue;

    const relation: StructureEdgeRelationType =
      params.apiPaths.has(sourcePath) || params.apiPaths.has(targetPath)
        ? "api"
        : FileClassifier.isConfigFile(sourcePath) || FileClassifier.isConfigFile(targetPath)
          ? "config"
          : "focus";

    addWeightedEdge(params.edges, sourceGroup, targetGroup, relation, Math.max(1, edge.weight));
  }
}
export function connectDirectionalGroups(
  edges: Map<
    string,
    { relation: StructureEdgeRelationType; source: string; target: string; weight: number }
  >,
  sources: string[],
  targets: string[],
  relation: StructureEdgeRelationType,
  weight = 1
) {
  for (const source of unique(sources)) {
    for (const target of unique(targets)) {
      addWeightedEdge(edges, source, target, relation, weight);
    }
  }
}
export function addSemanticTopologyEdges(
  edges: Map<
    string,
    { relation: StructureEdgeRelationType; source: string; target: string; weight: number }
  >,
  groupMap: Map<string, StructureGroupEntry>,
  primaryEntrypointGroups: string[]
) {
  const groupsByKind = collectGroupsByKind(groupMap);
  const frontendGroups = getStrongGroups(groupsByKind.get("frontend"), groupMap, 3);
  const apiGroups = getStrongGroups(groupsByKind.get("api"), groupMap, 4);
  const backendGroups = getStrongGroups(groupsByKind.get("backend"), groupMap, 4);
  const coreGroups = getStrongGroups(groupsByKind.get("core"), groupMap, 4);
  const dataGroups = getStrongGroups(groupsByKind.get("data"), groupMap, 4);
  const sharedGroups = getStrongGroups(groupsByKind.get("shared"), groupMap, 4);
  const configGroups = getStrongGroups(groupsByKind.get("config"), groupMap, 3);
  const infrastructureGroups = getStrongGroups(groupsByKind.get("infrastructure"), groupMap, 3);

  connectDirectionalGroups(edges, primaryEntrypointGroups, apiGroups, "entrypoint", 4);
  connectDirectionalGroups(edges, primaryEntrypointGroups, backendGroups, "entrypoint", 3);
  connectDirectionalGroups(edges, primaryEntrypointGroups, frontendGroups, "entrypoint", 2);

  connectDirectionalGroups(edges, frontendGroups, apiGroups, "focus", 3);
  connectDirectionalGroups(edges, frontendGroups, sharedGroups, "focus", 2);
  connectDirectionalGroups(edges, apiGroups, backendGroups, "api", 4);
  connectDirectionalGroups(edges, apiGroups, dataGroups, "api", 2);
  connectDirectionalGroups(edges, backendGroups, coreGroups, "focus", 3);
  connectDirectionalGroups(edges, backendGroups, dataGroups, "focus", 3);
  connectDirectionalGroups(edges, backendGroups, sharedGroups, "focus", 2);
  connectDirectionalGroups(edges, coreGroups, dataGroups, "focus", 2);
  connectDirectionalGroups(edges, infrastructureGroups, backendGroups, "config", 2);
  connectDirectionalGroups(edges, infrastructureGroups, dataGroups, "config", 2);
  connectDirectionalGroups(edges, configGroups, backendGroups, "config", 2);
  connectDirectionalGroups(edges, configGroups, apiGroups, "config", 1);
}
export function createStructuralContextEdges(params: {
  aiResult: AIResult;
  apiPaths: Set<string>;
  groupMap: Map<string, StructureGroupEntry>;
  metrics: RepoMetrics;
}) {
  const edges = new Map<
    string,
    { relation: StructureEdgeRelationType; source: string; target: string; weight: number }
  >();
  const docInput = params.metrics.documentationInput;

  const primaryEntrypointGroups = buildGroupKeySet(
    filterMeaningfulEntrypoints(params.metrics.entrypoints),
    params.apiPaths
  );
  const primaryModuleGroups = buildGroupKeySet(
    docInput?.sections.overview.body.primaryModules ?? [],
    params.apiPaths
  );

  for (const source of primaryEntrypointGroups) {
    for (const target of primaryModuleGroups) {
      addWeightedEdge(edges, source, target, "entrypoint", 3);
    }
  }

  addSemanticTopologyEdges(edges, params.groupMap, primaryEntrypointGroups);
  addGraphPreviewEdges({
    apiPaths: params.apiPaths,
    edges,
    metrics: params.metrics,
  });

  connectGroupSet(
    edges,
    buildGroupKeySet(params.metrics.routeInventory?.sourceFiles ?? [], params.apiPaths),
    "api",
    2
  );
  connectGroupSet(
    edges,
    buildGroupKeySet(docInput?.api.publicSurfacePaths ?? [], params.apiPaths),
    "api",
    2
  );
  connectGroupSet(
    edges,
    buildGroupKeySet(params.metrics.hotspotFiles ?? [], params.apiPaths),
    "risk",
    2
  );
  connectGroupSet(
    edges,
    buildGroupKeySet(params.metrics.configInventory ?? [], params.apiPaths),
    "config",
    1
  );

  for (const cycle of docInput?.architecture.dependencyCycles ?? []) {
    connectGroupSet(edges, buildGroupKeySet(cycle, params.apiPaths), "cycle", 3);
  }

  for (const finding of params.aiResult.findings ?? []) {
    connectGroupSet(
      edges,
      buildGroupKeySet(
        finding.evidence.map((item) => item.path),
        params.apiPaths
      ),
      "risk",
      2
    );
  }

  for (const fact of params.aiResult.repository_facts ?? []) {
    connectGroupSet(
      edges,
      buildGroupKeySet(
        fact.evidence.map((item) => item.path),
        params.apiPaths
      ),
      "focus",
      1
    );
  }

  for (const pathSet of [
    docInput?.sections.onboarding.body.firstLookPaths ?? [],
    docInput?.sections.onboarding.body.apiPaths ?? [],
    docInput?.sections.onboarding.body.configPaths ?? [],
    docInput?.sections.onboarding.body.riskPaths ?? [],
  ]) {
    connectGroupSet(edges, buildGroupKeySet(pathSet, params.apiPaths), "focus", 1);
  }

  return Array.from(edges.values())
    .sort((left, right) => right.weight - left.weight || left.source.localeCompare(right.source))
    .slice(0, 24)
    .map((edge) => ({
      id: `${edge.source}-${edge.target}-${edge.relation}`,
      relation: edge.relation,
      source: edge.source,
      target: edge.target,
      weight: edge.weight,
    }));
}
export function buildDrilldownEdges(params: {
  childNodes: ReturnType<typeof buildStructureNodeSummary>[];
  context: StructureContext;
  parentPath: string;
}) {
  const childIdSet = new Set(params.childNodes.map((child) => child.id));
  const edgeMap = new Map<
    string,
    { relation: StructureEdgeRelationType; source: string; target: string; weight: number }
  >();

  function connectPaths(paths: string[], relation: StructureEdgeRelationType, weight: number) {
    const ids = unique(
      paths
        .map((path) => resolveImmediateChildScope(params.parentPath, normalizePath(path)))
        .filter((scope): scope is NonNullable<typeof scope> => scope != null)
        .map((scope) => makeStructureNodeId(scope.nodeType, scope.path))
        .filter((id) => childIdSet.has(id))
    );

    for (let index = 0; index < ids.length; index += 1) {
      const source = ids[index];
      if (source == null) continue;
      for (let inner = index + 1; inner < ids.length; inner += 1) {
        const target = ids[inner];
        if (target == null || target === source) continue;
        addWeightedEdge(edgeMap, source, target, relation, weight);
        addWeightedEdge(edgeMap, target, source, relation, weight);
      }
    }
  }

  function connectGraphPreviewEdges() {
    for (const edge of params.context.metrics.graphPreviewEdges ?? []) {
      const sourceScope = resolveImmediateChildScope(
        params.parentPath,
        normalizePath(edge.fromPath)
      );
      const targetScope = resolveImmediateChildScope(params.parentPath, normalizePath(edge.toPath));

      if (sourceScope == null || targetScope == null) continue;

      const sourceId = makeStructureNodeId(sourceScope.nodeType, sourceScope.path);
      const targetId = makeStructureNodeId(targetScope.nodeType, targetScope.path);
      if (sourceId === targetId) continue;
      if (!childIdSet.has(sourceId) || !childIdSet.has(targetId)) continue;

      const relation: StructureEdgeRelationType =
        params.context.apiPaths.has(normalizePath(edge.fromPath)) ||
        params.context.apiPaths.has(normalizePath(edge.toPath))
          ? "api"
          : FileClassifier.isConfigFile(edge.fromPath) || FileClassifier.isConfigFile(edge.toPath)
            ? "config"
            : "focus";

      addWeightedEdge(edgeMap, sourceId, targetId, relation, Math.max(1, edge.weight + 1));
      addWeightedEdge(edgeMap, targetId, sourceId, relation, Math.max(1, edge.weight + 1));
    }
  }

  connectPaths(
    [
      ...params.context.meaningfulEntrypoints,
      ...(params.context.docInput?.sections.overview.body.primaryModules ?? []),
    ],
    "entrypoint",
    2
  );
  connectPaths(params.context.metrics.routeInventory?.sourceFiles ?? [], "api", 2);
  connectPaths(params.context.docInput?.api.publicSurfacePaths ?? [], "api", 2);
  connectPaths(params.context.metrics.hotspotFiles ?? [], "risk", 2);
  connectPaths(params.context.metrics.configInventory ?? [], "config", 1);

  for (const cycle of params.context.docInput?.architecture.dependencyCycles ?? []) {
    connectPaths(cycle, "cycle", 3);
  }

  for (const finding of params.context.aiResult.findings ?? []) {
    connectPaths(
      finding.evidence.map((item) => item.path),
      "risk",
      2
    );
  }

  for (const fact of params.context.aiResult.repository_facts ?? []) {
    connectPaths(
      fact.evidence.map((item) => item.path),
      "focus",
      1
    );
  }

  for (const pathSet of [
    params.context.docInput?.sections.onboarding.body.firstLookPaths ?? [],
    params.context.docInput?.sections.onboarding.body.apiPaths ?? [],
    params.context.docInput?.sections.onboarding.body.configPaths ?? [],
    params.context.docInput?.sections.onboarding.body.riskPaths ?? [],
  ]) {
    connectPaths(pathSet, "focus", 1);
  }

  connectGraphPreviewEdges();

  return Array.from(edgeMap.values())
    .sort((left, right) => right.weight - left.weight || left.source.localeCompare(right.source))
    .slice(0, 24)
    .map((edge) => ({
      id: `${edge.source}-${edge.target}-${edge.relation}`,
      relation: edge.relation,
      source: edge.source,
      target: edge.target,
      weight: edge.weight,
    }));
}
