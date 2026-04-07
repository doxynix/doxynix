import type { RepoMetrics } from "@/server/features/analyze-repo/lib/types";
import { normalizeRepoPath as normalizePath } from "@/server/shared/engine/core/common";
import { FileClassifier } from "@/server/shared/engine/core/file-classifier";

import { StructureGroupEntry, StructureSemanticKind } from "./analysis-utils";
import { buildStructureNodeSummary } from "./graph-navigator";

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
    shared: {
      description: "Cross-cutting shared primitives reused across the codebase.",
      label: "Shared",
    },
    unknown: {
      description: "A structural area without a stronger semantic signal yet.",
      label: "Module",
    },
  };
export const GROUPING_ROOTS = new Set([
  "app",
  "apps",
  "backend",
  "client",
  "cli",
  "cmd",
  "components",
  "core",
  "crates",
  "desktop",
  "domain",
  "entities",
  "extensions",
  "features",
  "frontend",
  "include",
  "internal",
  "lib",
  "libs",
  "mobile",
  "modules",
  "packages",
  "pages",
  "plugins",
  "pkg",
  "sdk",
  "server",
  "services",
  "shared",
  "src",
  "workers",
  "widgets",
]);
export const JVM_SOURCE_ROOTS = new Set([
  "clojure",
  "groovy",
  "java",
  "kotlin",
  "resources",
  "scala",
]);
export const POLYGLOT_CONFIG_HINTS = [
  "build.gradle",
  "build.gradle.kts",
  "cmakelists.txt",
  "cargo.toml",
  "deno.json",
  "deno.jsonc",
  "directory.build.props",
  "directory.packages.props",
  "dockerfile",
  "gemfile",
  "go.mod",
  "makefile",
  "meson.build",
  "mix.exs",
  "package.json",
  "pipfile",
  "pipfile.lock",
  "poetry.lock",
  "pom.xml",
  "pyproject.toml",
  "rebar.config",
  "requirements.txt",
  "settings.gradle",
  "settings.gradle.kts",
  "setup.cfg",
  "setup.py",
];
export const GENERIC_GROUP_ROOTS = new Set([
  "app",
  "apps",
  "backend",
  "client",
  "cli",
  "cmd",
  "components",
  "core",
  "crates",
  "domain",
  "frontend",
  "include",
  "internal",
  "lib",
  "libs",
  "mobile",
  "modules",
  "packages",
  "pages",
  "pkg",
  "sdk",
  "server",
  "services",
  "shared",
  "src",
  "workers",
]);
export function deriveGroupId(path: string) {
  const normalized = normalizePath(path);
  const parts = normalized.split("/").filter(Boolean);

  if (parts.length === 0) return "other";
  if (parts[0]?.startsWith(".")) return parts[0];

  if (
    parts[0] === "src" &&
    (parts[1] === "main" || parts[1] === "test") &&
    parts[2] != null &&
    JVM_SOURCE_ROOTS.has(parts[2])
  ) {
    if (parts[3] == null || parts[2] === "resources") return `src/${parts[1]}/${parts[2]}`;
    return `src/${parts[1]}/${parts[2]}/${parts[3]}`;
  }

  if (parts[0] === "src") {
    if (parts[1] == null) return "src";
    if (parts[2] == null) return `src/${parts[1]}`;
    return `src/${parts[1]}/${parts[2]}`;
  }

  if (GROUPING_ROOTS.has(parts[0] ?? "") && parts[1] != null) {
    return `${parts[0]}/${parts[1]}`;
  }

  return parts[0] ?? "other";
}
export function prettifyGroupLabel(groupId: string) {
  const parts = groupId.split("/").filter(Boolean);
  const raw =
    parts[0] === "src" && (parts[1] === "main" || parts[1] === "test")
      ? parts.slice(-3).join(" / ")
      : parts.slice(-2).join(" / ");
  return raw.replace(/[-_]/g, " ");
}
export function collectSemanticKinds(path: string, apiPaths: Set<string>): StructureSemanticKind[] {
  const normalized = normalizePath(path);
  const lower = normalized.toLowerCase();
  const kinds = new Set<StructureSemanticKind>();

  if (
    apiPaths.has(normalized) ||
    FileClassifier.isApiFile(normalized) ||
    /(^|\/)(api|routers|routes|controllers|handlers|trpc|grpc|rpc|gateway|endpoints?)(\/|$)/iu.test(
      lower
    )
  ) {
    kinds.add("api");
  }
  if (
    /(^|\/)(server|backend|services|workers|jobs|cli|cmd|internal|daemon|commands?|processors?|consumers?)(\/|$)/iu.test(
      lower
    ) ||
    lower.startsWith("src/server/")
  ) {
    kinds.add("backend");
  }
  if (
    /(^|\/)(app|pages|components|features|widgets|frontend|client|ui|screens|views|templates|android|ios)(\/|$)/iu.test(
      lower
    ) ||
    lower.startsWith("src/app/")
  ) {
    kinds.add("frontend");
  }
  if (
    /(^|\/)(shared|common|utils|helpers|sdk|kernel|base)(\/|$)/iu.test(lower) ||
    lower.startsWith("src/shared/")
  ) {
    kinds.add("shared");
  }
  if (/(^|\/)(engine|core|domain|runtime|kernel)(\/|$)/iu.test(lower)) {
    kinds.add("core");
  }
  if (
    /(^|\/)(prisma|migrations|schema|schemas|db|database|repositories|repository|persistence|storage|store|dao|orm|redis|mongo|postgres|mysql|sqlite)(\/|$)/iu.test(
      lower
    )
  ) {
    kinds.add("data");
  }
  if (
    FileClassifier.isInfraFile(normalized) ||
    /(^|\/)(infra|infrastructure|adapters|drivers|integrations|deploy|helm|terraform|ansible|k8s|kubernetes|cloud|providers)(\/|$)/iu.test(
      lower
    )
  ) {
    kinds.add("infrastructure");
  }
  if (
    /(^|\/)(config|configs)(\/|$)/iu.test(lower) ||
    FileClassifier.isConfigFile(normalized) ||
    POLYGLOT_CONFIG_HINTS.some((hint) => lower.endsWith(hint))
  ) {
    kinds.add("config");
  }

  if (kinds.size === 0) kinds.add("unknown");
  return Array.from(kinds);
}
export function pickPrimarySemanticKind(
  counts: Record<StructureSemanticKind, number>
): StructureSemanticKind {
  return (
    (Object.entries(counts).sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0])
    )[0]?.[0] as StructureSemanticKind | undefined) ?? "unknown"
  );
}
export function describeGroup(groupId: string, primaryKind: StructureSemanticKind) {
  const label = prettifyGroupLabel(groupId);
  return `${label}: ${SEMANTIC_META[primaryKind].description}`;
}
export function isBroadGenericGroupPath(groupPath: string) {
  const normalized = normalizePath(groupPath);
  if (normalized === "other") return true;
  if (normalized.startsWith(".")) return true;

  const parts = normalized.split("/").filter(Boolean);
  if (parts.length === 0) return true;
  if (parts.length === 1 && GENERIC_GROUP_ROOTS.has(parts[0] ?? "")) return true;
  if (normalized === "src") return true;
  if (
    /^src\/[^/]+$/u.test(normalized) &&
    !/^src\/(app|api|server|shared|core|features|entities|widgets)$/u.test(normalized)
  ) {
    return true;
  }

  return false;
}
export function getGenericGroupPenalty(node: ReturnType<typeof buildStructureNodeSummary>) {
  if (node.nodeType !== "group") return 0;

  let penalty = 0;
  if (isBroadGenericGroupPath(node.path)) penalty += 10;
  if (node.path === "other") penalty += 12;
  if (node.kind === "unknown") penalty += 6;

  const hasStrongSignal = node.markers.entrypoint || node.markers.api || node.markers.risk;
  if (!hasStrongSignal && !node.markers.shared && !node.markers.config) penalty += 4;
  if (!hasStrongSignal && node.stats.pathCount < 3) penalty += 6;

  if (hasStrongSignal) penalty -= 6;
  if (node.kind === "core" || node.kind === "backend" || node.kind === "api") penalty -= 2;

  return Math.max(0, penalty);
}
export function isLikelyBarrelPath(path: string) {
  const normalized = normalizePath(path).toLowerCase();
  return /(^|\/)index\.(ts|tsx|js|jsx|mts|cts)$/u.test(normalized);
}
export function buildGroupKeySet(paths: string[], _apiPaths: Set<string>) {
  return unique(paths.map((path) => deriveGroupId(path)));
}

export function getPrimaryKindForEntry(entry: StructureGroupEntry) {
  return pickPrimarySemanticKind(entry.semanticCounts);
}
export function filterMeaningfulEntrypoints(paths: string[]) {
  const normalized = unique(paths.filter(hasPath).map((path) => normalizePath(path)));
  const nonBarrel = normalized.filter((path) => !isLikelyBarrelPath(path));
  return nonBarrel.length > 0 ? nonBarrel : normalized;
}
export function isNoisyConfigOnlyPath(path: string) {
  return FileClassifier.isLowSignalConfigFile(path);
}
export function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

export function hasPath(value: string | undefined | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
export function summarizeGroupImportance(params: {
  apiCount: number;
  changeCouplingCount: number;
  churnCount: number;
  configCount: number;
  dependencyHotspotCount: number;
  entrypointCount: number;
  frameworkCount: number;
  groupId: string;
  graphWarningCount: number;
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
  const normalizedPath = normalizePath(params.path);
  const signals = params.signalMap.get(normalizedPath) ?? new Set();
  let score = 0;

  if (signals.has("entrypoint")) score += 5;
  if (signals.has("api")) score += 4;
  if (signals.has("hotspot") || signals.has("finding")) score += 4;
  if (signals.has("fact") || signals.has("onboarding")) score += 3;
  if (signals.has("config") && !isNoisyConfigOnlyPath(normalizedPath)) score += 1;

  if (params.graphRelatedPaths.has(normalizedPath)) score += 3;
  if ((params.metrics.documentationInput?.api.publicSurfacePaths ?? []).includes(normalizedPath))
    score += 3;
  if ((params.metrics.routeInventory?.sourceFiles ?? []).includes(normalizedPath)) score += 2;

  if (FileClassifier.isApiFile(normalizedPath)) score += 2;
  if (FileClassifier.isArchitectureRelevant(normalizedPath)) score += 2;
  if (FileClassifier.isPrimaryEntrypointFile(normalizedPath)) score += 2;
  if (FileClassifier.isConfigFile(normalizedPath) && !isNoisyConfigOnlyPath(normalizedPath))
    score += 1;

  const groupId = deriveGroupId(normalizedPath);
  if (isBroadGenericGroupPath(groupId)) score -= 2;
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
  const normalizedPath = normalizePath(path);
  if (FileClassifier.isSensitiveFile(normalizedPath)) return false;
  if (FileClassifier.isIgnored(normalizedPath)) return false;

  const signals = signalMap.get(normalizedPath) ?? new Set();
  const hasStrongSignal =
    signals.has("entrypoint") ||
    signals.has("api") ||
    signals.has("hotspot") ||
    signals.has("finding") ||
    signals.has("fact") ||
    signals.has("onboarding");

  if (hasStrongSignal) return true;
  if (signals.has("config")) return !isNoisyConfigOnlyPath(normalizedPath);
  if (FileClassifier.isLikelyBarrelFile(normalizedPath)) return false;
  if (FileClassifier.isDocsFile(normalizedPath)) return false;
  if (FileClassifier.isGeneratedFile(normalizedPath)) return false;
  if (FileClassifier.isTestFile(normalizedPath)) return false;
  if (FileClassifier.isAssetFile(normalizedPath)) return false;
  if (FileClassifier.isToolingFile(normalizedPath)) return false;

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
export function rankStructureNode(node: ReturnType<typeof buildStructureNodeSummary>) {
  let rank = node.score;
  if (node.nodeType === "group") rank += 6;
  if (node.markers.entrypoint) rank += 12;
  if (node.markers.api) rank += 10;
  if (node.markers.risk) rank += 8;
  if (node.markers.config) rank += 4;
  if (node.markers.shared) rank += 3;
  if (node.kind !== "unknown") rank += 2;
  if (node.nodeType === "file" && FileClassifier.isLikelyBarrelFile(node.path)) rank -= 8;
  rank -= getGenericGroupPenalty(node);
  return rank;
}
export function isMeaningfulTopLevelNode(node: ReturnType<typeof buildStructureNodeSummary>) {
  if (
    isBroadGenericGroupPath(node.path) &&
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
export function isMeaningfulChildNode(node: ReturnType<typeof buildStructureNodeSummary>) {
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

  if (FileClassifier.isLikelyBarrelFile(node.path)) return false;
  return FileClassifier.isArchitectureRelevant(node.path) || FileClassifier.isApiFile(node.path);
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
