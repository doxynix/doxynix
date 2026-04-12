import { normalizeRepoPath } from "@/server/shared/engine/core/common";
import { ProjectPolicy } from "@/server/shared/engine/core/project-policy";
import {
  toAnalysisRef,
  type AnalysisRef,
  type RepoWithLatestAnalysisAndDocs,
} from "@/server/shared/infrastructure/repo-snapshots";
import { unique } from "@/server/shared/lib/array-utils";

import { buildDrilldownEdges } from "./edge-builder";
import { buildInspectPayload } from "./inspect";
import {
  buildGroupKeySet,
  describeGroup,
  getGenericGroupPenalty,
  isMeaningfulChildNode,
  isMeaningfulTopLevelNode,
  rankStructureNode,
  SEMANTIC_META,
  summarizeGroupImportance,
} from "./semantics";
import {
  aggregateEntryForPaths,
  buildBreadcrumbs,
  buildStructureContext,
} from "./structure-context";
import {
  isPathInsideScope,
  makeStructureNodeId,
  parseStructureNodeId,
  resolveImmediateChildScope,
  type StructureContext,
  type StructureGroupEntry,
  type StructureNodeType,
} from "./structure-shared";

function createSummarizeImportance() {
  return (input: {
    apiCount: number;
    changeCouplingCount: number;
    churnCount: number;
    configCount: number;
    dependencyHotspotCount: number;
    entrypointCount: number;
    frameworkCount: number;
    graphWarningCount: number;
    groupId: string;
    hotspotCount: number;
    orphanCount: number;
    primaryKind: string;
    riskCount: number;
    sampleCount: number;
  }) =>
    summarizeGroupImportance({
      ...input,
      primaryKind: input.primaryKind as Parameters<
        typeof summarizeGroupImportance
      >[0]["primaryKind"],
    });
}

export function buildStructureMapPayloadFromContext(
  context: StructureContext,
  analysisRef: AnalysisRef | null
) {
  const summarizeImportance = createSummarizeImportance();
  const nodes = buildTopLevelNodes(context);
  const nodeLabelById = new Map(nodes.map((node) => [node.id, node.label] as const));
  const edges = context.rawTopLevelEdges.map((edge) => ({
    ...edge,
    id: `${makeStructureNodeId("group", edge.source)}-${makeStructureNodeId("group", edge.target)}-${edge.relation}`,
    source: makeStructureNodeId("group", edge.source),
    target: makeStructureNodeId("group", edge.target),
  }));

  const inspectByNodeId = Object.fromEntries(
    nodes.map((node) => {
      const entry = context.groupMap.get(node.path)!;
      const outgoing = context.rawTopLevelEdges
        .filter((edge) => edge.source === node.path)
        .sort((left, right) => right.weight - left.weight)
        .map(
          (edge) =>
            nodeLabelById.get(makeStructureNodeId("group", edge.target)) ??
            ProjectPolicy.getGroupLabel(edge.target)
        )
        .slice(0, 5);
      const incoming = context.rawTopLevelEdges
        .filter((edge) => edge.target === node.path)
        .sort((left, right) => right.weight - left.weight)
        .map(
          (edge) =>
            nodeLabelById.get(makeStructureNodeId("group", edge.source)) ??
            ProjectPolicy.getGroupLabel(edge.source)
        )
        .slice(0, 5);

      return [
        node.id,
        buildInspectPayload({
          entry,
          incoming,
          node,
          outgoing,
          semanticLabel: SEMANTIC_META[node.kind].label,
          summarizeImportance,
        }),
      ];
    })
  );

  const defaultNode = selectDefaultTopLevelNode(context, nodes);

  return {
    analysisRef,
    filters: {
      api: nodes.filter((node) => node.markers.api).map((node) => node.id),
      client: nodes.filter((node) => node.markers.client).map((node) => node.id),
      entrypoints: nodes.filter((node) => node.markers.entrypoint).map((node) => node.id),
      server: nodes.filter((node) => node.markers.server).map((node) => node.id),
      shared: nodes.filter((node) => node.markers.shared).map((node) => node.id),
    },
    graph: {
      edges,
      groups: nodes.map((node) => ({
        description: node.description,
        id: node.id,
        label: node.label,
      })),
      nodes,
    },
    inspect: {
      byNodeId: inspectByNodeId,
      defaultNodeId: defaultNode?.id ?? null,
    },
    overview: {
      architectureStyle: context.aiResult.executive_summary.architecture_style,
      primaryEntrypoints: context.meaningfulEntrypoints.slice(0, 6),
      primaryModules: context.docInput?.sections.overview.body.primaryModules.slice(0, 6) ?? [],
      purpose: context.aiResult.executive_summary.purpose,
      repositoryKind: context.docInput?.sections.overview.body.repositoryKind ?? "unknown",
      stack: context.docInput?.sections.overview.body.stackProfile ?? context.metrics.techStack,
    },
    selection: {
      defaultNodeId: defaultNode?.id ?? null,
    },
  };
}
export type StructureMapPayload = NonNullable<
  ReturnType<typeof buildStructureMapPayloadFromContext>
>;

export function buildStructureMapPayload(repo: RepoWithLatestAnalysisAndDocs) {
  const context = buildStructureContext(repo);
  if (context == null) return null;
  const analysisRef = toAnalysisRef(repo.analyses[0]);
  return buildStructureMapPayloadFromContext(context, analysisRef);
}
export function buildTopLevelNodes(context: StructureContext) {
  const nodes = Array.from(context.groupMap.entries())
    .map(([groupId, entry]) =>
      buildStructureNodeSummary({ entry, nodeType: "group", path: groupId })
    )
    .sort(
      (left, right) =>
        rankStructureNode(right) - rankStructureNode(left) || left.label.localeCompare(right.label)
    );

  const prioritized = nodes.filter(isMeaningfulTopLevelNode);
  const fallback = nodes.filter(
    (node) => !prioritized.some((candidate) => candidate.id === node.id)
  );
  return [...prioritized, ...fallback].slice(0, 14);
}
export function selectDefaultTopLevelNode(
  context: StructureContext,
  nodes: ReturnType<typeof buildStructureNodeSummary>[]
) {
  if (nodes.length === 0) return null;

  const firstLookGroups = new Set(
    buildGroupKeySet(
      context.docInput?.sections.onboarding.body.firstLookPaths ?? [],
      context.apiPaths
    )
  );
  const primaryModuleGroups = new Set(
    buildGroupKeySet(
      context.docInput?.sections.overview.body.primaryModules ?? [],
      context.apiPaths
    )
  );
  const entrypointGroups = new Set(
    buildGroupKeySet(context.meaningfulEntrypoints, context.apiPaths)
  );
  const apiGroups = new Set(
    buildGroupKeySet(context.metrics.routeInventory?.sourceFiles ?? [], context.apiPaths)
  );
  const riskGroups = new Set(
    buildGroupKeySet(context.docInput?.sections.onboarding.body.riskPaths ?? [], context.apiPaths)
  );
  const graphWeightByGroup = new Map<string, number>();

  for (const edge of context.rawTopLevelEdges) {
    graphWeightByGroup.set(edge.source, (graphWeightByGroup.get(edge.source) ?? 0) + edge.weight);
    graphWeightByGroup.set(edge.target, (graphWeightByGroup.get(edge.target) ?? 0) + edge.weight);
  }

  const scored = nodes.map((node) => {
    let score = rankStructureNode(node);

    if (firstLookGroups.has(node.path)) score += 28;
    if (primaryModuleGroups.has(node.path)) score += 20;
    if (entrypointGroups.has(node.path)) score += 18;
    if (apiGroups.has(node.path)) score += 14;
    if (riskGroups.has(node.path)) score += 10;

    score += Math.min(14, graphWeightByGroup.get(node.path) ?? 0);

    if (node.kind === "core" || node.kind === "backend" || node.kind === "api") score += 6;
    if (node.kind === "frontend" || node.kind === "data") score += 3;

    score -= getGenericGroupPenalty(node);

    if (node.markers.config && !node.markers.entrypoint && !node.markers.api) score -= 8;
    if (
      node.markers.shared &&
      !node.markers.entrypoint &&
      !node.markers.api &&
      !node.markers.risk
    ) {
      score -= 3;
    }

    return {
      node,
      score,
    };
  });

  return (
    scored.toSorted(
      (left, right) => right.score - left.score || left.node.label.localeCompare(right.node.label)
    )[0]?.node ?? null
  );
}
export function buildStructureNodePayloadFromContext(
  context: StructureContext,
  analysisRef: AnalysisRef | null,
  nodeId: string
) {
  const summarizeImportance = createSummarizeImportance();
  const { nodeType, path } = parseStructureNodeId(nodeId);

  if (nodeType === "file") {
    const normalizedPath = normalizeRepoPath(path);
    if (!context.allInterestingPaths.includes(normalizedPath)) return null;

    const entry = aggregateEntryForPaths([normalizedPath], context);
    const node = buildStructureNodeSummary({ entry, nodeType: "file", path: normalizedPath });

    return {
      analysisRef,
      breadcrumbs: buildBreadcrumbs("file", normalizedPath),
      canDrillDeeper: false,
      children: [],
      edges: [],
      inspect: {
        ...buildInspectPayload({
          context,
          currentPath: normalizedPath,
          entry,
          incoming: [],
          node,
          outgoing: [],
          semanticLabel: SEMANTIC_META[node.kind].label,
          summarizeImportance,
        }),
        contains: [],
      },
      node,
    };
  }

  const scopedPaths = context.allInterestingPaths.filter((candidatePath) =>
    isPathInsideScope(candidatePath, path)
  );
  if (scopedPaths.length === 0) return null;

  const entry = aggregateEntryForPaths(scopedPaths, context);
  const node = buildStructureNodeSummary({ entry, nodeType: "group", path });

  const childScopes = new Map<string, { nodeType: StructureNodeType; path: string }>();
  for (const candidatePath of scopedPaths) {
    const scope = resolveImmediateChildScope(path, candidatePath);
    if (scope == null) continue;
    childScopes.set(makeStructureNodeId(scope.nodeType, scope.path), scope);
  }

  const childNodes = Array.from(childScopes.values())
    .map((scope) => {
      const childPaths =
        scope.nodeType === "file"
          ? scopedPaths.filter((candidatePath) => candidatePath === scope.path)
          : scopedPaths.filter((candidatePath) => isPathInsideScope(candidatePath, scope.path));
      const childEntry = aggregateEntryForPaths(childPaths, context);
      return buildStructureNodeSummary({
        entry: childEntry,
        nodeType: scope.nodeType,
        path: scope.path,
      });
    })
    .sort((left, right) => {
      if (left.nodeType !== right.nodeType) return left.nodeType === "group" ? -1 : 1;
      return (
        rankStructureNode(right) - rankStructureNode(left) || left.label.localeCompare(right.label)
      );
    });

  const meaningfulChildren = childNodes.filter(isMeaningfulChildNode);
  const sourceChildren = meaningfulChildren.length > 0 ? meaningfulChildren : childNodes;
  const limitedChildren = [
    ...sourceChildren.filter((child) => child.nodeType === "group").slice(0, 10),
    ...sourceChildren.filter((child) => child.nodeType === "file").slice(0, 6),
  ];
  const edges = buildDrilldownEdges({ childNodes: limitedChildren, context, parentPath: path });

  return {
    analysisRef,
    breadcrumbs: buildBreadcrumbs("group", path),
    canDrillDeeper: limitedChildren.some(
      (child) => child.canDrillDeeper || child.nodeType === "file"
    ),
    children: limitedChildren,
    edges,
    inspect: {
      ...buildInspectPayload({
        context,
        currentPath: path,
        entry,
        incoming: [],
        node,
        outgoing: limitedChildren.map((child) => child.label).slice(0, 5),
        relatedChildPaths: limitedChildren.map((child) => child.path),
        semanticLabel: SEMANTIC_META[node.kind].label,
        summarizeImportance,
      }),
      contains: limitedChildren.map((child) => child.label).slice(0, 8),
    },
    node,
  };
}
export type StructureNodePayload = NonNullable<
  ReturnType<typeof buildStructureNodePayloadFromContext>
>;

export function buildStructureNodePayload(repo: RepoWithLatestAnalysisAndDocs, nodeId: string) {
  const context = buildStructureContext(repo);
  if (context == null) return null;
  const analysisRef = toAnalysisRef(repo.analyses[0]);
  return buildStructureNodePayloadFromContext(context, analysisRef, nodeId);
}
export function buildStructureNodeSummary(params: {
  entry: StructureGroupEntry;
  nodeType: StructureNodeType;
  path: string;
}) {
  const uniquePathsInGroup = unique(params.entry.paths);
  const primaryKind = ProjectPolicy.getPrimarySemanticKind(params.entry.semanticCounts);
  const entrypointCount = unique(params.entry.entrypointDetails.map((item) => item.path)).length;
  const apiCount = unique(params.entry.apiPaths).length;
  const churnCount = unique(params.entry.churnHotspots.map((item) => item.path)).length;
  const changeCouplingCount = unique(
    params.entry.changeCoupling.flatMap((item) => [item.fromPath, item.toPath])
  ).length;
  const configCount = unique(params.entry.configPaths).length;
  const hotspotCount = unique(params.entry.hotspotSignals.map((item) => item.path)).length;
  const dependencyHotspotCount = unique(
    params.entry.dependencyHotspots.map((item) => item.path)
  ).length;
  const graphWarningCount = unique(
    params.entry.graphUnresolvedSamples.map((item) => item.fromPath)
  ).length;
  const orphanCount = unique(params.entry.orphanPaths).length;
  const frameworkCount = unique(params.entry.frameworkNames).length;
  const riskCount = unique(params.entry.riskTitles).length;
  const score =
    entrypointCount * 4 +
    apiCount * 3 +
    riskCount * 2 +
    hotspotCount * 2 +
    churnCount * 2 +
    changeCouplingCount * 2 +
    dependencyHotspotCount * 2 +
    graphWarningCount +
    orphanCount +
    frameworkCount +
    configCount +
    uniquePathsInGroup.length;
  const canDrillDeeper =
    params.nodeType === "group" &&
    uniquePathsInGroup.some((candidatePath) => candidatePath.startsWith(`${params.path}/`));

  return {
    canDrillDeeper,
    description:
      params.nodeType === "group"
        ? describeGroup(params.path, primaryKind)
        : `${params.path}: ${SEMANTIC_META[primaryKind].description}`,
    id: makeStructureNodeId(params.nodeType, params.path),
    kind: primaryKind,
    label:
      params.nodeType === "group"
        ? ProjectPolicy.getGroupLabel(params.path)
        : (params.path.split("/").findLast(Boolean) ?? params.path),
    markers: {
      api: apiCount > 0,
      client: params.entry.semanticCounts.frontend > 0,
      config: configCount > 0,
      entrypoint: entrypointCount > 0,
      risk:
        riskCount > 0 ||
        hotspotCount > 0 ||
        churnCount > 0 ||
        changeCouplingCount > 0 ||
        dependencyHotspotCount > 0 ||
        graphWarningCount > 0 ||
        orphanCount > 0,
      server:
        params.entry.semanticCounts.api > 0 ||
        params.entry.semanticCounts.backend > 0 ||
        params.entry.semanticCounts.core > 0 ||
        params.entry.semanticCounts.data > 0 ||
        params.entry.semanticCounts.infrastructure > 0,
      shared: params.entry.semanticCounts.shared > 0,
    },
    nodeType: params.nodeType,
    path: params.path,
    previewPaths: uniquePathsInGroup.slice(0, 6),
    score,
    stats: {
      apiCount,
      changeCouplingCount,
      churnCount,
      configCount,
      dependencyHotspotCount,
      entrypointCount,
      frameworkCount,
      graphWarningCount,
      hotspotCount,
      orphanCount,
      pathCount: uniquePathsInGroup.length,
      riskCount,
    },
  };
}
