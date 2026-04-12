import { normalizeRepoPath } from "@/server/shared/engine/core/common";
import { ProjectPolicy } from "@/server/shared/engine/core/project-policy";
import { unique } from "@/server/shared/lib/array-utils";
import { excludePath } from "@/server/shared/lib/path-operations";

import { isPathInsideScope } from "./structure-shared";

type StructureInspectNodeType = "file" | "group";

type OnboardingDocInputLike = null | {
  sections?: {
    onboarding?: {
      body?: {
        firstLookPaths?: string[];
      };
    };
  };
};

export type StructureInspectContextLike = {
  docInput?: OnboardingDocInputLike;
};

type StructureEntrypointLike = {
  path: string;
};

type StructureHotspotSignalLike = {
  churnScore: number;
  complexity: number;
  path: string;
  score: number;
};

type StructureDependencyHotspotLike = {
  exports: number;
  inbound: number;
  outbound: number;
  path: string;
};

type StructureChangeCouplingLike = {
  fromPath: string;
  toPath: string;
};

type StructureChurnHotspotLike = {
  path: string;
};

export type StructureInspectEntryLike = {
  apiPaths: string[];
  changeCoupling: StructureChangeCouplingLike[];
  churnHotspots: StructureChurnHotspotLike[];
  configPaths: string[];
  dependencyHotspots: StructureDependencyHotspotLike[];
  entrypointDetails: StructureEntrypointLike[];
  graphNeighborPaths: string[];
  graphUnresolvedSamples: Array<unknown>;
  hotspotSignals: StructureHotspotSignalLike[];
  orphanPaths: string[];
  paths: string[];
  publicSurfacePaths: string[];
  riskTitles: string[];
};

export type StructureInspectNodeLike = {
  canDrillDeeper: boolean;
  markers: {
    api: boolean;
    config: boolean;
    entrypoint: boolean;
  };
  nodeType: StructureInspectNodeType;
};

export function buildSuggestedPathsForEntry(params: {
  context: StructureInspectContextLike;
  currentPath: string;
  entry: StructureInspectEntryLike;
  relatedChildPaths: string[];
}) {
  const currentPath = normalizeRepoPath(params.currentPath);
  const prioritizedSuggestions = [
    ...params.relatedChildPaths,
    ...params.entry.graphNeighborPaths,
    ...(params.context.docInput?.sections?.onboarding?.body?.firstLookPaths ?? []).filter(
      (candidatePath) =>
        params.entry.paths.some((scopePath) => isPathInsideScope(candidatePath, scopePath)) &&
        normalizeRepoPath(candidatePath) !== currentPath
    ),
    ...params.entry.entrypointDetails.map((item) => normalizeRepoPath(item.path)),
    ...params.entry.apiPaths,
    ...params.entry.publicSurfacePaths,
    ...params.entry.hotspotSignals.map((item) => normalizeRepoPath(item.path)),
    ...params.entry.churnHotspots.map((item) => normalizeRepoPath(item.path)),
    ...params.entry.changeCoupling.flatMap((item) => [
      normalizeRepoPath(item.fromPath),
      normalizeRepoPath(item.toPath),
    ]),
    ...params.entry.dependencyHotspots.map((item) => normalizeRepoPath(item.path)),
    ...params.entry.orphanPaths,
    ...params.entry.configPaths,
  ];

  return excludePath(prioritizedSuggestions, currentPath, 6);
}

export function buildNeighborPathsForEntry(params: {
  currentPath: string;
  entry: StructureInspectEntryLike;
  relatedChildPaths: string[];
}) {
  const normalizedCurrentPath = normalizeRepoPath(params.currentPath);

  const coupledNeighbors = params.entry.changeCoupling.flatMap((pair) => {
    const fromPath = normalizeRepoPath(pair.fromPath);
    const toPath = normalizeRepoPath(pair.toPath);
    if (fromPath === normalizedCurrentPath) return [toPath];
    if (toPath === normalizedCurrentPath) return [fromPath];
    return [fromPath, toPath];
  });

  const prioritizedNeighbors = [
    ...coupledNeighbors,
    ...params.entry.hotspotSignals.map((item) => normalizeRepoPath(item.path)),
    ...params.entry.dependencyHotspots.map((item) => normalizeRepoPath(item.path)),
    ...params.entry.graphNeighborPaths,
    ...params.entry.publicSurfacePaths,
    ...params.entry.apiPaths,
    ...params.entry.entrypointDetails.map((item) => normalizeRepoPath(item.path)),
    ...params.relatedChildPaths,
  ];

  return excludePath(prioritizedNeighbors, normalizedCurrentPath, 6);
}

export function buildNeighborBucketsForEntry(params: {
  currentPath: string;
  entry: StructureInspectEntryLike;
  relatedChildPaths: string[];
}) {
  const normalizedCurrentPath = normalizeRepoPath(params.currentPath);

  const coupledNeighbors = params.entry.changeCoupling.flatMap((pair) => {
    const fromPath = normalizeRepoPath(pair.fromPath);
    const toPath = normalizeRepoPath(pair.toPath);
    if (fromPath === normalizedCurrentPath) return [toPath];
    if (toPath === normalizedCurrentPath) return [fromPath];
    return [fromPath, toPath];
  });

  return {
    apiNeighbors: excludePath(
      [...params.entry.apiPaths, ...params.entry.publicSurfacePaths],
      normalizedCurrentPath,
      4
    ),
    changeRiskNeighbors: excludePath(
      [
        ...params.entry.hotspotSignals.map((item) => normalizeRepoPath(item.path)),
        ...params.entry.dependencyHotspots.map((item) => normalizeRepoPath(item.path)),
        ...coupledNeighbors,
      ],
      normalizedCurrentPath,
      4
    ),
    configNeighbors: excludePath(params.entry.configPaths, normalizedCurrentPath, 4),
    coupledNeighbors: excludePath(
      [...coupledNeighbors, ...params.entry.graphNeighborPaths],
      normalizedCurrentPath,
      4
    ),
    entryFlowNeighbors: excludePath(
      [
        ...params.entry.entrypointDetails.map((item) => normalizeRepoPath(item.path)),
        ...params.relatedChildPaths.filter((candidatePath) =>
          ProjectPolicy.isPrimaryEntrypoint(candidatePath)
        ),
      ],
      normalizedCurrentPath,
      4
    ),
    entryNeighbors: excludePath(
      params.entry.entrypointDetails.map((item) => normalizeRepoPath(item.path)),
      normalizedCurrentPath,
      4
    ),
    graphNeighbors: excludePath(params.entry.graphNeighborPaths, normalizedCurrentPath, 4),
    publicSurfaceNeighbors: excludePath(
      [...params.entry.publicSurfacePaths, ...params.entry.apiPaths],
      normalizedCurrentPath,
      4
    ),
    relatedChildNeighbors: excludePath(params.relatedChildPaths, normalizedCurrentPath, 4),
    riskNeighbors: excludePath(
      [
        ...params.entry.hotspotSignals.map((item) => normalizeRepoPath(item.path)),
        ...params.entry.dependencyHotspots.map((item) => normalizeRepoPath(item.path)),
      ],
      normalizedCurrentPath,
      4
    ),
  };
}

export function buildReviewPriority(params: {
  entry: StructureInspectEntryLike;
  node: StructureInspectNodeLike;
}) {
  const score =
    (params.node.markers.entrypoint ? 3 : 0) +
    (params.node.markers.api ? 3 : 0) +
    params.entry.hotspotSignals.length * 2 +
    params.entry.dependencyHotspots.length * 2 +
    params.entry.graphNeighborPaths.length +
    params.entry.changeCoupling.length +
    params.entry.churnHotspots.length +
    params.entry.graphUnresolvedSamples.length +
    params.entry.orphanPaths.length +
    params.entry.riskTitles.length * 2;

  if (score >= 10) {
    return {
      level: "high" as const,
      reason: "This node combines high-impact structural or change-risk signals.",
    };
  }

  if (score >= 5) {
    return {
      level: "medium" as const,
      reason: "This node has enough structural or git-history signals to deserve a careful review.",
    };
  }

  return {
    level: "low" as const,
    reason: "This node looks relatively localized compared with the main structural hotspots.",
  };
}

export function buildRecommendedActions(params: {
  entry: StructureInspectEntryLike;
  node: StructureInspectNodeLike;
}) {
  const actions: string[] = [];

  if (params.node.markers.entrypoint) actions.push("Inspect entry flow first");
  if (params.node.markers.api) actions.push("Review API/public surface");
  if (params.entry.hotspotSignals.length > 0 || params.entry.dependencyHotspots.length > 0) {
    actions.push("Run quick audit before editing");
  }
  if (params.entry.changeCoupling.length > 0 || params.entry.churnHotspots.length > 0) {
    actions.push("Check git neighbors before refactor");
  }
  if (params.entry.graphNeighborPaths.length > 0) {
    actions.push("Inspect graph neighbors before editing");
  }
  if (params.node.nodeType === "file") {
    actions.push("Generate file documentation");
  } else if (params.node.canDrillDeeper) {
    actions.push("Drill deeper into this area");
  }
  if (params.node.markers.config) actions.push("Verify config/runtime assumptions");
  if (params.entry.graphUnresolvedSamples.length > 0 || params.entry.orphanPaths.length > 0) {
    actions.push("Manually verify dependency links");
  }

  return unique(actions).slice(0, 5);
}
