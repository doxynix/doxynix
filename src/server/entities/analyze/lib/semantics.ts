import { normalizeRepoPath } from "@/server/shared/engine/core/common";
import type { RepoMetrics } from "@/server/shared/engine/core/metrics.types";
import { ProjectPolicy } from "@/server/shared/engine/core/project-policy";
import { unique } from "@/server/shared/lib/array-utils";
import { hasText } from "@/server/shared/lib/string-utils";

import type { StructureGroupEntry, StructureSemanticKind } from "./structure-shared";

type StructureNodeSummaryLike = {
  kind: string;
  label: string;
  markers: {
    api: boolean;
    config: boolean;
    entrypoint: boolean;
    risk: boolean;
    server: boolean;
    shared: boolean;
  };
  nodeType: "file" | "group";
  path: string;
  score: number;
  stats: {
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
};

export const SEMANTIC_META: Record<StructureSemanticKind, { description: string; label: string }> =
  {
    api: { description: "Public API and externally reachable interface paths.", label: "API" },
    backend: {
      description: "Backend runtime, orchestration, services or server-side logic.",
      label: "Backend",
    },
    config: {
      description: "Configuration, environment or runtime setup surface.",
      label: "Config",
    },
    core: {
      description: "Core domain or engine logic that anchors important behavior.",
      label: "Core",
    },
    data: {
      description: "Persistence, schema, migrations or data-access concerns.",
      label: "Data",
    },
    frontend: {
      description: "UI, app shell or client-facing flow composition.",
      label: "Frontend",
    },
    infrastructure: {
      description: "Adapters and infrastructure integrations around the main runtime.",
      label: "Infrastructure",
    },
    ml: {
      description: "Machine learning models, training pipelines, datasets or inference logic.",
      label: "Machine Learning",
    },
    mobile: {
      description: "Mobile-specific application code, platform assets or cross-platform flows.",
      label: "Mobile",
    },
    shared: {
      description: "Cross-cutting shared primitives reused across the codebase.",
      label: "Shared",
    },
    unknown: {
      description: "A structural area without a stronger semantic signal yet.",
      label: "Module",
    },
  };

export function collectSemanticKinds(path: string, apiPaths: Set<string>): StructureSemanticKind[] {
  return ProjectPolicy.getSemanticKinds(path, { apiPaths }) as StructureSemanticKind[];
}

export function describeGroup(groupId: string, primaryKind: StructureSemanticKind) {
  const label = ProjectPolicy.getGroupLabel(groupId);
  return `${label}: ${SEMANTIC_META[primaryKind].description}`;
}

export function getGenericGroupPenalty(node: StructureNodeSummaryLike) {
  if (node.nodeType !== "group") return 0;

  let penalty = ProjectPolicy.getGenericGroupPathPenalty(node.path);
  if (node.kind === "unknown") penalty += 6;

  const hasStrongSignal = node.markers.entrypoint || node.markers.api || node.markers.risk;
  if (!hasStrongSignal && !node.markers.shared && !node.markers.config) penalty += 4;
  if (!hasStrongSignal && node.stats.pathCount < 3) penalty += 6;

  if (hasStrongSignal) penalty -= 6;
  if (node.kind === "core" || node.kind === "backend" || node.kind === "api") penalty -= 2;

  return Math.max(0, penalty);
}

export function isLikelyBarrelPath(path: string) {
  const normalized = normalizeRepoPath(path).toLowerCase();
  return /(^|\/)index\.(ts|tsx|js|jsx|mts|cts)$/u.test(normalized);
}

export function buildGroupKeySet(paths: string[], _apiPaths: Set<string>) {
  return unique(paths.map((path) => ProjectPolicy.deriveGroupId(path)));
}

export function getPrimaryKindForEntry(entry: StructureGroupEntry) {
  return ProjectPolicy.getPrimarySemanticKind(entry.semanticCounts);
}

export function filterMeaningfulEntrypoints(paths: string[]) {
  const normalized = unique(paths.filter(hasText).map((path) => normalizeRepoPath(path)));
  const nonBarrel = normalized.filter((path) => !isLikelyBarrelPath(path));
  return nonBarrel.length > 0 ? nonBarrel : normalized;
}

export function summarizeGroupImportance(params: {
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
  primaryKind: StructureSemanticKind;
  riskCount: number;
  sampleCount: number;
}) {
  const reasons: string[] = [];

  if (params.entrypointCount > 0) reasons.push("contains likely entrypoints");
  if (params.apiCount > 0) reasons.push("surfaces public API or route files");
  if (params.riskCount > 0) reasons.push("appears in high-risk or hotspot evidence");
  if (params.churnCount > 0) reasons.push("shows recent git activity concentration");
  if (params.changeCouplingCount > 0)
    reasons.push("changes here tend to move with neighboring paths");
  if (params.configCount > 0) reasons.push("contains configuration or runtime setup");
  if (params.frameworkCount > 0) reasons.push("shows framework or runtime integration signals");
  if (params.dependencyHotspotCount > 0) reasons.push("contains dependency-central files");
  if (params.orphanCount > 0) reasons.push("includes isolated runtime paths worth reviewing");
  if (params.graphWarningCount > 0) reasons.push("has partial dependency-resolution evidence");
  if (params.hotspotCount > 0 && params.riskCount === 0)
    reasons.push("concentrates hotspot candidates");
  if (params.sampleCount >= 8 && reasons.length === 0)
    reasons.push("covers a large structural area");

  if (reasons.length === 0) return describeGroup(params.groupId, params.primaryKind);

  return `${describeGroup(params.groupId, params.primaryKind)} This area ${reasons.join(", ")}.`;
}

export function getStructureSeedScore(params: {
  apiPaths: Set<string>;
  graphRelatedPaths: Set<string>;
  metrics: RepoMetrics;
  path: string;
  signalMap: Map<
    string,
    Set<"api" | "config" | "entrypoint" | "fact" | "finding" | "hotspot" | "onboarding">
  >;
}) {
  const normalizedPath = normalizeRepoPath(params.path);
  const signals = params.signalMap.get(normalizedPath) ?? new Set();
  let score = 0;

  if (signals.has("entrypoint")) score += 5;
  if (signals.has("api")) score += 4;
  if (signals.has("hotspot") || signals.has("finding")) score += 4;
  if (signals.has("fact") || signals.has("onboarding")) score += 3;
  if (signals.has("config") && !ProjectPolicy.isLowSignalConfig(normalizedPath)) score += 1;

  if (params.graphRelatedPaths.has(normalizedPath)) score += 3;
  if ((params.metrics.documentationInput?.api.publicSurfacePaths ?? []).includes(normalizedPath))
    score += 3;
  if ((params.metrics.routeInventory?.sourceFiles ?? []).includes(normalizedPath)) score += 2;

  if (ProjectPolicy.isApiPath(normalizedPath)) score += 2;
  if (ProjectPolicy.isArchitectureRelevant(normalizedPath)) score += 2;
  if (ProjectPolicy.isPrimaryEntrypoint(normalizedPath)) score += 2;
  if (
    ProjectPolicy.isConfigFile(normalizedPath) &&
    !ProjectPolicy.isLowSignalConfig(normalizedPath)
  )
    score += 1;

  const groupId = ProjectPolicy.deriveGroupId(normalizedPath);
  if (ProjectPolicy.isBroadGenericGroupPath(groupId)) score -= 2;
  if (normalizedPath.split("/").filter(Boolean).length <= 1) score -= 2;

  return score;
}

export function shouldKeepStructurePath(
  path: string,
  signalMap: Map<
    string,
    Set<"api" | "config" | "entrypoint" | "fact" | "finding" | "hotspot" | "onboarding">
  >,
  metrics: RepoMetrics,
  apiPaths: Set<string>,
  graphRelatedPaths: Set<string>
) {
  const normalizedPath = normalizeRepoPath(path);
  if (ProjectPolicy.isSensitive(normalizedPath)) return false;
  if (ProjectPolicy.isIgnored(normalizedPath)) return false;

  const signals = signalMap.get(normalizedPath) ?? new Set();
  const hasStrongSignal =
    signals.has("entrypoint") ||
    signals.has("api") ||
    signals.has("hotspot") ||
    signals.has("finding") ||
    signals.has("fact") ||
    signals.has("onboarding");

  if (hasStrongSignal) return true;
  if (signals.has("config")) return !ProjectPolicy.isLowSignalConfig(normalizedPath);
  if (ProjectPolicy.isLikelyBarrelFile(normalizedPath)) return false;
  if (ProjectPolicy.isDocsFile(normalizedPath)) return false;
  if (ProjectPolicy.isGeneratedFile(normalizedPath)) return false;
  if (ProjectPolicy.isTestFile(normalizedPath)) return false;
  if (ProjectPolicy.isAssetFile(normalizedPath)) return false;
  if (ProjectPolicy.isToolingFile(normalizedPath)) return false;

  return (
    getStructureSeedScore({
      apiPaths,
      graphRelatedPaths,
      metrics,
      path: normalizedPath,
      signalMap,
    }) >= 2
  );
}

export function rankStructureNode(node: StructureNodeSummaryLike) {
  let rank = node.score;
  if (node.nodeType === "group") rank += 6;
  if (node.markers.entrypoint) rank += 12;
  if (node.markers.api) rank += 10;
  if (node.markers.risk) rank += 8;
  if (node.markers.config) rank += 4;
  if (node.markers.shared) rank += 3;
  if (node.kind !== "unknown") rank += 2;
  if (node.nodeType === "file" && ProjectPolicy.isLikelyBarrelFile(node.path)) rank -= 8;
  rank -= getGenericGroupPenalty(node);
  return rank;
}

export function isMeaningfulTopLevelNode(node: StructureNodeSummaryLike) {
  if (
    ProjectPolicy.isBroadGenericGroupPath(node.path) &&
    !node.markers.entrypoint &&
    !node.markers.api &&
    !node.markers.risk &&
    node.stats.pathCount < 3
  ) {
    return false;
  }

  if (node.markers.entrypoint || node.markers.api || node.markers.risk) return true;
  if (node.markers.config || node.markers.shared) return true;
  if (node.stats.pathCount >= 2) return true;
  return node.kind !== "unknown";
}

export function isMeaningfulChildNode(node: StructureNodeSummaryLike) {
  if (node.nodeType === "group") {
    return (
      node.markers.entrypoint ||
      node.markers.api ||
      node.markers.risk ||
      node.markers.config ||
      node.markers.shared ||
      node.stats.pathCount >= 2 ||
      node.kind !== "unknown"
    );
  }

  if (node.markers.entrypoint || node.markers.api || node.markers.risk || node.markers.config) {
    return true;
  }

  if (ProjectPolicy.isLikelyBarrelFile(node.path)) return false;
  return ProjectPolicy.isArchitectureRelevant(node.path) || ProjectPolicy.isApiPath(node.path);
}

export function collectGroupsByKind(groupMap: Map<string, StructureGroupEntry>) {
  const byKind = new Map<StructureSemanticKind, string[]>();

  for (const [groupId, entry] of groupMap.entries()) {
    const kind = getPrimaryKindForEntry(entry);
    const current = byKind.get(kind) ?? [];
    current.push(groupId);
    byKind.set(kind, current);
  }

  return byKind;
}

export function getStrongGroups(
  groups: string[] | undefined,
  groupMap: Map<string, StructureGroupEntry>,
  limit: number
) {
  return (groups ?? [])
    .slice()
    .sort((left, right) => {
      const leftEntry = groupMap.get(left);
      const rightEntry = groupMap.get(right);
      const leftScore =
        (leftEntry?.entrypointDetails.length ?? 0) * 4 +
        (leftEntry?.apiPaths.length ?? 0) * 3 +
        (leftEntry?.riskTitles.length ?? 0) * 2 +
        (leftEntry?.paths.length ?? 0);
      const rightScore =
        (rightEntry?.entrypointDetails.length ?? 0) * 4 +
        (rightEntry?.apiPaths.length ?? 0) * 3 +
        (rightEntry?.riskTitles.length ?? 0) * 2 +
        (rightEntry?.paths.length ?? 0);

      return rightScore - leftScore || left.localeCompare(right);
    })
    .slice(0, limit);
}
