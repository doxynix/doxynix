import { normalizeRepoPath } from "@/server/shared/engine/core/common";
import { FileClassifier } from "@/server/shared/engine/core/file-classifier";

type StructureInspectNodeType = "file" | "group";

type OnboardingDocInputLike = {
  sections?: {
    onboarding?: {
      body?: {
        firstLookPaths?: string[];
      };
    };
  };
} | null;

type StructureInspectContextLike = {
  docInput?: OnboardingDocInputLike;
};

type StructureEntrypointLike = {
  path: string;
};

type StructureHotspotSignalLike = {
  complexity: number;
  churnScore: number;
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

type StructureInspectEntryLike = {
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

type StructureInspectNodeLike = {
  canDrillDeeper: boolean;
  markers: {
    api: boolean;
    config: boolean;
    entrypoint: boolean;
  };
  nodeType: StructureInspectNodeType;
};

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function normalizePath(path: string) {
  return normalizeRepoPath(path);
}

function isPathInsideScope(path: string, scopePath: string) {
  const normalizedPath = normalizePath(path);
  const normalizedScope = normalizePath(scopePath);
  return normalizedPath === normalizedScope || normalizedPath.startsWith(`${normalizedScope}/`);
}

export function buildSuggestedPathsForEntry(params: {
  context: StructureInspectContextLike;
  currentPath: string;
  entry: StructureInspectEntryLike;
  relatedChildPaths: string[];
}) {
  const currentPath = normalizePath(params.currentPath);
  const prioritizedSuggestions = [
    ...params.relatedChildPaths,
    ...params.entry.graphNeighborPaths,
    ...(params.context.docInput?.sections?.onboarding?.body?.firstLookPaths ?? []).filter(
      (candidatePath) =>
        params.entry.paths.some((scopePath) => isPathInsideScope(candidatePath, scopePath)) &&
        normalizePath(candidatePath) !== currentPath
    ),
    ...params.entry.entrypointDetails.map((item) => normalizePath(item.path)),
    ...params.entry.apiPaths,
    ...params.entry.publicSurfacePaths,
    ...params.entry.hotspotSignals.map((item) => normalizePath(item.path)),
    ...params.entry.churnHotspots.map((item) => normalizePath(item.path)),
    ...params.entry.changeCoupling.flatMap((item) => [
      normalizePath(item.fromPath),
      normalizePath(item.toPath),
    ]),
    ...params.entry.dependencyHotspots.map((item) => normalizePath(item.path)),
    ...params.entry.orphanPaths,
    ...params.entry.configPaths,
  ];

  return unique(
    prioritizedSuggestions.filter((candidatePath) => normalizePath(candidatePath) !== currentPath)
  ).slice(0, 6);
}

export function buildNeighborPathsForEntry(params: {
  currentPath: string;
  entry: StructureInspectEntryLike;
  relatedChildPaths: string[];
}) {
  const normalizedCurrentPath = normalizePath(params.currentPath);

  const coupledNeighbors = params.entry.changeCoupling.flatMap((pair) => {
    const fromPath = normalizePath(pair.fromPath);
    const toPath = normalizePath(pair.toPath);
    if (fromPath === normalizedCurrentPath) return [toPath];
    if (toPath === normalizedCurrentPath) return [fromPath];
    return [fromPath, toPath];
  });

  const prioritizedNeighbors = [
    ...coupledNeighbors,
    ...params.entry.hotspotSignals.map((item) => normalizePath(item.path)),
    ...params.entry.dependencyHotspots.map((item) => normalizePath(item.path)),
    ...params.entry.graphNeighborPaths,
    ...params.entry.publicSurfacePaths,
    ...params.entry.apiPaths,
    ...params.entry.entrypointDetails.map((item) => normalizePath(item.path)),
    ...params.relatedChildPaths,
  ];

  return unique(
    prioritizedNeighbors.filter(
      (candidatePath) => normalizePath(candidatePath) !== normalizedCurrentPath
    )
  ).slice(0, 6);
}

export function buildNeighborBucketsForEntry(params: {
  currentPath: string;
  entry: StructureInspectEntryLike;
  relatedChildPaths: string[];
}) {
  const normalizedCurrentPath = normalizePath(params.currentPath);

  const coupledNeighbors = params.entry.changeCoupling.flatMap((pair) => {
    const fromPath = normalizePath(pair.fromPath);
    const toPath = normalizePath(pair.toPath);
    if (fromPath === normalizedCurrentPath) return [toPath];
    if (toPath === normalizedCurrentPath) return [fromPath];
    return [fromPath, toPath];
  });

  return {
    apiNeighbors: unique(
      [...params.entry.apiPaths, ...params.entry.publicSurfacePaths].filter(
        (candidatePath) => normalizePath(candidatePath) !== normalizedCurrentPath
      )
    ).slice(0, 4),
    changeRiskNeighbors: unique(
      [
        ...params.entry.hotspotSignals.map((item) => normalizePath(item.path)),
        ...params.entry.dependencyHotspots.map((item) => normalizePath(item.path)),
        ...coupledNeighbors,
      ].filter((candidatePath) => normalizePath(candidatePath) !== normalizedCurrentPath)
    ).slice(0, 4),
    configNeighbors: unique(
      params.entry.configPaths.filter(
        (candidatePath) => normalizePath(candidatePath) !== normalizedCurrentPath
      )
    ).slice(0, 4),
    coupledNeighbors: unique(
      [...coupledNeighbors, ...params.entry.graphNeighborPaths].filter(
        (candidatePath) => normalizePath(candidatePath) !== normalizedCurrentPath
      )
    ).slice(0, 4),
    entryFlowNeighbors: unique(
      [
        ...params.entry.entrypointDetails.map((item) => normalizePath(item.path)),
        ...params.relatedChildPaths.filter((candidatePath) =>
          FileClassifier.isLikelyEntrypoint(candidatePath)
        ),
      ].filter((candidatePath) => normalizePath(candidatePath) !== normalizedCurrentPath)
    ).slice(0, 4),
    entryNeighbors: unique(
      params.entry.entrypointDetails
        .map((item) => normalizePath(item.path))
        .filter((candidatePath) => normalizePath(candidatePath) !== normalizedCurrentPath)
    ).slice(0, 4),
    publicSurfaceNeighbors: unique(
      [...params.entry.publicSurfacePaths, ...params.entry.apiPaths].filter(
        (candidatePath) => normalizePath(candidatePath) !== normalizedCurrentPath
      )
    ).slice(0, 4),
    graphNeighbors: unique(
      params.entry.graphNeighborPaths.filter(
        (candidatePath) => normalizePath(candidatePath) !== normalizedCurrentPath
      )
    ).slice(0, 4),
    relatedChildNeighbors: unique(
      params.relatedChildPaths.filter(
        (candidatePath) => normalizePath(candidatePath) !== normalizedCurrentPath
      )
    ).slice(0, 4),
    riskNeighbors: unique(
      [
        ...params.entry.hotspotSignals.map((item) => normalizePath(item.path)),
        ...params.entry.dependencyHotspots.map((item) => normalizePath(item.path)),
      ].filter((candidatePath) => normalizePath(candidatePath) !== normalizedCurrentPath)
    ).slice(0, 4),
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
