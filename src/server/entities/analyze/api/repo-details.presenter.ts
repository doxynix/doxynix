import { DocType } from "@prisma/client";

import {
  buildExplainConfidence,
  buildNodeExplainSummary,
  buildNodeRole,
} from "@/server/entities/analyze/lib/repo-details-explain";
import { buildInspectPayload } from "@/server/entities/analyze/lib/repo-details-inspect";
import { buildSuggestedPathsForEntry } from "@/server/entities/analyze/lib/repo-details-node-context";
import {
  collectScopedEntrySignals,
  collectScopedSignals,
} from "@/server/entities/analyze/lib/repo-details-signals";
import { aiSchema, type AIResult } from "@/server/features/analyze-repo/lib/schemas";
import type { RepoMetrics } from "@/server/features/analyze-repo/lib/types";
import { normalizeRepoPath as normalizePath } from "@/server/shared/engine/core/common";
import { FileClassifier } from "@/server/shared/engine/core/file-classifier";
import {
  toAnalysisRef,
  type LatestCompletedAnalysis,
  type RepoWithLatestAnalysisAndDocs,
} from "@/server/shared/infrastructure/repo-snapshots";

type WriterStatus = "failed" | "fallback" | "llm" | "missing";
type StructureEdgeRelation = "api" | "config" | "cycle" | "entrypoint" | "focus" | "risk";
type StructureNodeType = "file" | "group";
type StructureSemanticKind =
  | "api"
  | "backend"
  | "config"
  | "core"
  | "data"
  | "frontend"
  | "infrastructure"
  | "shared"
  | "unknown";

type StoredDocument = RepoWithLatestAnalysisAndDocs["documents"][number];

const DOC_TYPE_ORDER: Record<DocType, number> = {
  [DocType.API]: 2,
  [DocType.ARCHITECTURE]: 1,
  [DocType.CHANGELOG]: 4,
  [DocType.CODE_DOC]: 5,
  [DocType.CONTRIBUTING]: 3,
  [DocType.README]: 0,
};

const WRITER_KEY_BY_DOC_TYPE: Partial<
  Record<DocType, keyof NonNullable<NonNullable<AIResult["analysisRuntime"]>["writers"]>>
> = {
  [DocType.API]: "api",
  [DocType.ARCHITECTURE]: "architecture",
  [DocType.CHANGELOG]: "changelog",
  [DocType.CONTRIBUTING]: "contributing",
  [DocType.README]: "readme",
};

function hasText(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

function coerceAnalysisPayload(analysis: LatestCompletedAnalysis | undefined | null) {
  if (analysis == null || analysis.metricsJson == null || analysis.resultJson == null) return null;

  const parsed = aiSchema.safeParse(analysis.resultJson);
  if (!parsed.success) return null;

  return {
    aiResult: parsed.data,
    analysis,
    metrics: analysis.metricsJson as RepoMetrics,
  };
}

function dedupeLatestDocsByType(docs: StoredDocument[]) {
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

function getWriterStatus(docType: DocType, aiResult: AIResult | null): WriterStatus | null {
  const writerKey = WRITER_KEY_BY_DOC_TYPE[docType];
  if (writerKey == null) return null;
  return aiResult?.analysisRuntime?.writers?.[writerKey] ?? null;
}

function normalizeWriterStatuses(aiResult: AIResult | null) {
  return {
    api: getWriterStatus(DocType.API, aiResult),
    architecture: getWriterStatus(DocType.ARCHITECTURE, aiResult),
    changelog: getWriterStatus(DocType.CHANGELOG, aiResult),
    contributing: getWriterStatus(DocType.CONTRIBUTING, aiResult),
    readme: getWriterStatus(DocType.README, aiResult),
  };
}

function toDocSummary(doc: StoredDocument, aiResult: AIResult | null) {
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

const SEMANTIC_META: Record<StructureSemanticKind, { description: string; label: string }> = {
  api: { description: "Public API and externally reachable interface paths.", label: "API" },
  backend: {
    description: "Backend runtime, orchestration, services or server-side logic.",
    label: "Backend",
  },
  config: { description: "Configuration, environment or runtime setup surface.", label: "Config" },
  core: {
    description: "Core domain or engine logic that anchors important behavior.",
    label: "Core",
  },
  data: { description: "Persistence, schema, migrations or data-access concerns.", label: "Data" },
  frontend: { description: "UI, app shell or client-facing flow composition.", label: "Frontend" },
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

const GROUPING_ROOTS = new Set([
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

const JVM_SOURCE_ROOTS = new Set(["clojure", "groovy", "java", "kotlin", "resources", "scala"]);

const POLYGLOT_CONFIG_HINTS = [
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

const GENERIC_GROUP_ROOTS = new Set([
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

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function hasPath(value: string | undefined | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isLikelyBarrelPath(path: string) {
  const normalized = normalizePath(path).toLowerCase();
  return /(^|\/)index\.(ts|tsx|js|jsx|mts|cts)$/u.test(normalized);
}

function filterMeaningfulEntrypoints(paths: string[]) {
  const normalized = unique(paths.filter(hasPath).map((path) => normalizePath(path)));
  const nonBarrel = normalized.filter((path) => !isLikelyBarrelPath(path));
  return nonBarrel.length > 0 ? nonBarrel : normalized;
}

function deriveGroupId(path: string) {
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

function prettifyGroupLabel(groupId: string) {
  const parts = groupId.split("/").filter(Boolean);
  const raw =
    parts[0] === "src" && (parts[1] === "main" || parts[1] === "test")
      ? parts.slice(-3).join(" / ")
      : parts.slice(-2).join(" / ");
  return raw.replace(/[-_]/g, " ");
}

function collectSemanticKinds(path: string, apiPaths: Set<string>): StructureSemanticKind[] {
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

function pickPrimarySemanticKind(
  counts: Record<StructureSemanticKind, number>
): StructureSemanticKind {
  return (
    (Object.entries(counts).sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0])
    )[0]?.[0] as StructureSemanticKind | undefined) ?? "unknown"
  );
}

function describeGroup(groupId: string, primaryKind: StructureSemanticKind) {
  const label = prettifyGroupLabel(groupId);
  return `${label}: ${SEMANTIC_META[primaryKind].description}`;
}

function buildApiPathSet(metrics: RepoMetrics) {
  return new Set(
    unique([
      ...(metrics.routeInventory?.sourceFiles ?? []),
      ...(metrics.documentationInput?.api.publicSurfacePaths ?? []),
    ]).map((path) => normalizePath(path))
  );
}

function createSemanticCounts(): Record<StructureSemanticKind, number> {
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

type StructureGroupEntry = {
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

type StructureContext = {
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
    relation: StructureEdgeRelation;
    source: string;
    target: string;
    weight: number;
  }>;
  signalMap: Map<
    string,
    Set<"api" | "config" | "entrypoint" | "fact" | "finding" | "hotspot" | "onboarding">
  >;
};

function createEmptyGroupEntry(): StructureGroupEntry {
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

function makeStructureNodeId(nodeType: StructureNodeType, path: string) {
  return `${nodeType}:${normalizePath(path)}`;
}

function parseStructureNodeId(nodeId: string): { nodeType: StructureNodeType; path: string } {
  if (nodeId.startsWith("group:")) {
    return { nodeType: "group", path: normalizePath(nodeId.slice("group:".length)) };
  }
  if (nodeId.startsWith("file:")) {
    return { nodeType: "file", path: normalizePath(nodeId.slice("file:".length)) };
  }
  return { nodeType: "group", path: normalizePath(nodeId) };
}

function isPathInsideScope(path: string, scopePath: string) {
  const normalizedPath = normalizePath(path);
  const normalizedScope = normalizePath(scopePath);
  return normalizedPath === normalizedScope || normalizedPath.startsWith(`${normalizedScope}/`);
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

function collectStructureSignalMap(params: {
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

function isNoisyConfigOnlyPath(path: string) {
  return FileClassifier.isLowSignalConfigFile(path);
}

function buildGraphRelatedPathSet(metrics: RepoMetrics) {
  return new Set(
    (metrics.graphPreviewEdges ?? []).flatMap((edge) => [
      normalizePath(edge.fromPath),
      normalizePath(edge.toPath),
    ])
  );
}

function getStructureSeedScore(params: {
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

function shouldKeepStructurePath(
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

function buildStructureContext(repo: RepoWithLatestAnalysisAndDocs): StructureContext | null {
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

function buildGroupKeySet(paths: string[], _apiPaths: Set<string>) {
  return unique(paths.map((path) => deriveGroupId(path)));
}

function getPrimaryKindForEntry(entry: StructureGroupEntry) {
  return pickPrimarySemanticKind(entry.semanticCounts);
}

function addWeightedEdge(
  edges: Map<
    string,
    { relation: StructureEdgeRelation; source: string; target: string; weight: number }
  >,
  source: string,
  target: string,
  relation: StructureEdgeRelation,
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

function connectGroupSet(
  edges: Map<
    string,
    { relation: StructureEdgeRelation; source: string; target: string; weight: number }
  >,
  groups: string[],
  relation: StructureEdgeRelation,
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

function addGraphPreviewEdges(params: {
  apiPaths: Set<string>;
  edges: Map<
    string,
    { relation: StructureEdgeRelation; source: string; target: string; weight: number }
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

    const relation: StructureEdgeRelation =
      params.apiPaths.has(sourcePath) || params.apiPaths.has(targetPath)
        ? "api"
        : FileClassifier.isConfigFile(sourcePath) || FileClassifier.isConfigFile(targetPath)
          ? "config"
          : "focus";

    addWeightedEdge(params.edges, sourceGroup, targetGroup, relation, Math.max(1, edge.weight));
  }
}

function connectDirectionalGroups(
  edges: Map<
    string,
    { relation: StructureEdgeRelation; source: string; target: string; weight: number }
  >,
  sources: string[],
  targets: string[],
  relation: StructureEdgeRelation,
  weight = 1
) {
  for (const source of unique(sources)) {
    for (const target of unique(targets)) {
      addWeightedEdge(edges, source, target, relation, weight);
    }
  }
}

function collectGroupsByKind(groupMap: Map<string, StructureGroupEntry>) {
  const byKind = new Map<StructureSemanticKind, string[]>();

  for (const [groupId, entry] of groupMap.entries()) {
    const kind = getPrimaryKindForEntry(entry);
    const current = byKind.get(kind) ?? [];
    current.push(groupId);
    byKind.set(kind, current);
  }

  return byKind;
}

function getStrongGroups(
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

function addSemanticTopologyEdges(
  edges: Map<
    string,
    { relation: StructureEdgeRelation; source: string; target: string; weight: number }
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

function createStructuralContextEdges(params: {
  aiResult: AIResult;
  apiPaths: Set<string>;
  groupMap: Map<string, StructureGroupEntry>;
  metrics: RepoMetrics;
}) {
  const edges = new Map<
    string,
    { relation: StructureEdgeRelation; source: string; target: string; weight: number }
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

function summarizeGroupImportance(params: {
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

function buildStructureNodeSummary(params: {
  entry: StructureGroupEntry;
  nodeType: StructureNodeType;
  path: string;
}) {
  const uniquePathsInGroup = unique(params.entry.paths);
  const primaryKind = pickPrimarySemanticKind(params.entry.semanticCounts);
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
    description:
      params.nodeType === "group"
        ? describeGroup(params.path, primaryKind)
        : `${params.path}: ${SEMANTIC_META[primaryKind].description}`,
    id: makeStructureNodeId(params.nodeType, params.path),
    kind: primaryKind,
    label:
      params.nodeType === "group"
        ? prettifyGroupLabel(params.path)
        : (params.path.split("/").filter(Boolean).at(-1) ?? params.path),
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
    canDrillDeeper,
  };
}

function aggregateEntryForPaths(paths: string[], context: StructureContext) {
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

function buildBreadcrumbs(nodeType: StructureNodeType, path: string) {
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

function resolveImmediateChildScope(parentPath: string, candidatePath: string) {
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

function isBroadGenericGroupPath(groupPath: string) {
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

function getGenericGroupPenalty(node: ReturnType<typeof buildStructureNodeSummary>) {
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

function rankStructureNode(node: ReturnType<typeof buildStructureNodeSummary>) {
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

function isMeaningfulTopLevelNode(node: ReturnType<typeof buildStructureNodeSummary>) {
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

function isMeaningfulChildNode(node: ReturnType<typeof buildStructureNodeSummary>) {
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

function buildTopLevelNodes(context: StructureContext) {
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

function selectDefaultTopLevelNode(
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
    scored.sort(
      (left, right) => right.score - left.score || left.node.label.localeCompare(right.node.label)
    )[0]?.node ?? null
  );
}

function buildStructureMapPayload(repo: RepoWithLatestAnalysisAndDocs) {
  const context = buildStructureContext(repo);
  if (context == null) return null;
  const analysisRef = toAnalysisRef(repo.analyses[0]);

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
            prettifyGroupLabel(edge.target)
        )
        .slice(0, 5);
      const incoming = context.rawTopLevelEdges
        .filter((edge) => edge.target === node.path)
        .sort((left, right) => right.weight - left.weight)
        .map(
          (edge) =>
            nodeLabelById.get(makeStructureNodeId("group", edge.source)) ??
            prettifyGroupLabel(edge.source)
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
          summarizeImportance: summarizeGroupImportance,
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

function buildDrilldownEdges(params: {
  childNodes: ReturnType<typeof buildStructureNodeSummary>[];
  context: StructureContext;
  parentPath: string;
}) {
  const childIdSet = new Set(params.childNodes.map((child) => child.id));
  const edgeMap = new Map<
    string,
    { relation: StructureEdgeRelation; source: string; target: string; weight: number }
  >();

  function connectPaths(paths: string[], relation: StructureEdgeRelation, weight: number) {
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

      const relation: StructureEdgeRelation =
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

function buildStructureNodePayload(repo: RepoWithLatestAnalysisAndDocs, nodeId: string) {
  const context = buildStructureContext(repo);
  if (context == null) return null;
  const analysisRef = toAnalysisRef(repo.analyses[0]);

  const { nodeType, path } = parseStructureNodeId(nodeId);

  if (nodeType === "file") {
    const normalizedPath = normalizePath(path);
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
          summarizeImportance: summarizeGroupImportance,
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
        summarizeImportance: summarizeGroupImportance,
      }),
      contains: limitedChildren.map((child) => child.label).slice(0, 8),
    },
    node,
  };
}

function collectNodeScopePaths(
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

function buildNodeExplainPayload(repo: RepoWithLatestAnalysisAndDocs, nodeId: string) {
  const context = buildStructureContext(repo);
  if (context == null) return null;
  const analysisRef = toAnalysisRef(repo.analyses[0]);

  const drilldown = buildStructureNodePayload(repo, nodeId);
  if (drilldown == null) return null;

  const { nodeType, path } = parseStructureNodeId(nodeId);
  const scopedPaths = collectNodeScopePaths(context, nodeType, path);
  if (scopedPaths.length === 0) return null;

  const entry = aggregateEntryForPaths(scopedPaths, context);
  const signals = collectScopedSignals(scopedPaths, context);
  const role = buildNodeRole(drilldown.node, SEMANTIC_META[drilldown.node.kind].label);

  const sourcePaths = unique([
    ...scopedPaths,
    ...signals.facts.flatMap((fact) => fact.evidence.map((item) => normalizePath(item.path))),
    ...signals.findings.flatMap((finding) =>
      finding.evidence.map((item) => normalizePath(item.path))
    ),
  ]).slice(0, 8);

  const nextSuggestedPaths =
    drilldown.inspect.nextSuggestedPaths ??
    buildSuggestedPathsForEntry({
      context,
      currentPath: path,
      entry,
      relatedChildPaths: drilldown.children.map((child) => child.path),
    });

  const confidence = buildExplainConfidence({
    findingsCount: signals.findings.length,
    node: drilldown.node,
    sourcePathCount: sourcePaths.length,
  });

  return {
    analysisRef,
    confidence,
    nextSuggestedPaths,
    node: {
      id: drilldown.node.id,
      kind: drilldown.node.kind,
      label: drilldown.node.label,
      nodeType: drilldown.node.nodeType,
      path: drilldown.node.path,
    },
    relationships: {
      apiHints: drilldown.inspect.apiHints,
      apiSurface: drilldown.node.markers.api,
      breadcrumbs: drilldown.breadcrumbs,
      contains: drilldown.inspect.contains ?? [],
      dependsOn: drilldown.inspect.dependsOn,
      entrypoint: drilldown.node.markers.entrypoint,
      entrypointReason: drilldown.inspect.entrypointReason,
      factTitles: unique([...entry.factTitles, ...signals.facts.map((fact) => fact.title)]).slice(
        0,
        5
      ),
      frameworkHints: drilldown.inspect.frameworkHints ?? [],
      graphHints: drilldown.inspect.graphHints ?? [],
      gitHints: drilldown.inspect.gitHints ?? [],
      hotspotHints: drilldown.inspect.hotspotHints ?? [],
      neighborBuckets: drilldown.inspect.neighborBuckets ?? null,
      neighborPaths: drilldown.inspect.neighborPaths ?? [],
      relatedPaths: drilldown.inspect.relatedPaths ?? [],
      recommendedActions: drilldown.inspect.recommendedActions ?? [],
      reviewPriority: drilldown.inspect.reviewPriority ?? null,
      riskTitles: unique(signals.findings.map((finding) => finding.title)).slice(0, 5),
      usedBy: drilldown.inspect.usedBy,
    },
    role,
    sourcePaths,
    summary: buildNodeExplainSummary({
      changeCouplingCount: entry.changeCoupling.length,
      churnCount: entry.churnHotspots.length,
      dependencyHotspotCount: entry.dependencyHotspots.length,
      findingsCount: signals.findings.length,
      frameworkCount: entry.frameworkNames.length,
      graphWarningCount: entry.graphUnresolvedSamples.length,
      hotspotCount: entry.hotspotSignals.length,
      node: drilldown.node,
      orphanCount: entry.orphanPaths.length,
      relatedFactCount: signals.facts.length,
      role,
      scopedPathCount: scopedPaths.length,
    }),
    whyImportant: drilldown.inspect.whyImportant,
  };
}

export const repoDetailsPresenter = {
  toAvailableDocs(repo: Pick<RepoWithLatestAnalysisAndDocs, "analyses" | "documents">) {
    const latestAnalysis = coerceAnalysisPayload(repo.analyses[0]);
    return dedupeLatestDocsByType(repo.documents).map((doc) =>
      toDocSummary(doc, latestAnalysis?.aiResult ?? null)
    );
  },

  toDetailedMetrics(analysis: LatestCompletedAnalysis | null) {
    const payload = coerceAnalysisPayload(analysis);
    if (payload == null) return null;

    const { aiResult, metrics } = payload;
    const findings = aiResult.findings ?? [];
    const facts = aiResult.repository_facts ?? [];

    return {
      architecture: {
        analysisCoverage: metrics.analysisCoverage,
        configInventory: metrics.configInventory,
        dependencyCycles: metrics.dependencyCycles,
        dependencyHotspots: metrics.dependencyHotspots,
        entrypoints: metrics.entrypoints,
        graphReliability: metrics.graphReliability ?? null,
        hotspotFiles: metrics.hotspotFiles,
        orphanModules: metrics.orphanModules,
        routeInventory: metrics.routeInventory ?? null,
      },
      onboarding: {
        guide: aiResult.onboarding_guide,
        score: metrics.onboardingScore,
        teamRoles: metrics.teamRoles,
      },
      quality: {
        analysisCoverage: metrics.analysisCoverage,
        busFactor: metrics.busFactor,
        complexity: metrics.complexityScore,
        dependencyCycles: metrics.dependencyCycles.length,
        docDensity: metrics.docDensity,
        duplicationPercentage: metrics.duplicationPercentage,
        health: metrics.healthScore,
        modularity: metrics.modularityIndex,
        security: metrics.securityScore,
        techDebt: metrics.techDebtScore,
      },
      recommendations: {
        bottlenecks: aiResult.mainBottlenecks ?? [],
        performance: aiResult.sections.performance,
        refactoringTargets: aiResult.refactoring_targets,
        techDebt: aiResult.sections.tech_debt,
      },
      reference: {
        apiStructure: aiResult.sections.api_structure,
        dataFlow: aiResult.sections.data_flow,
        swagger: aiResult.swaggerYaml ?? null,
      },
      risks: {
        facts,
        findings,
        hotspotFiles: metrics.hotspotFiles,
        topRisks: findings.slice(0, 5),
      },
      security: {
        findings: metrics.securityFindings,
        risks: aiResult.sections.security_audit.risks,
        score: aiResult.sections.security_audit.score,
        securityScanStatus: metrics.securityScanStatus,
        vulnerabilities: aiResult.vulnerabilities ?? [],
      },
    };
  },

  toOverview(repo: RepoWithLatestAnalysisAndDocs) {
    const payload = coerceAnalysisPayload(repo.analyses[0]);
    if (payload == null) return null;

    const { aiResult, metrics } = payload;
    const docs = this.toAvailableDocs(repo);

    return {
      docs: {
        availableCount: docs.length,
        availableTypes: docs.map((doc) => doc.type),
        hasSwagger: hasText(aiResult.swaggerYaml),
        items: docs,
        writers: normalizeWriterStatuses(aiResult),
      },
      languages: metrics.languages,
      maintenance: metrics.maintenanceStatus,
      mostComplexFiles: metrics.mostComplexFiles,
      repo: {
        defaultBranch: repo.defaultBranch,
        description: repo.description,
        forks: repo.forks,
        id: repo.publicId,
        language: repo.language,
        license: repo.license,
        name: repo.name,
        openIssues: repo.openIssues,
        owner: repo.owner,
        ownerAvatarUrl: repo.ownerAvatarUrl,
        pushedAt: repo.pushedAt,
        size: repo.size,
        stars: repo.stars,
        topics: repo.topics,
        url: repo.url,
        visibility: repo.visibility,
      },
      scores: {
        complexity: metrics.complexityScore,
        health: metrics.healthScore,
        onboarding: metrics.onboardingScore,
        security: metrics.securityScore,
        techDebt: metrics.techDebtScore,
      },
      signals: {
        analysisCoverage: metrics.analysisCoverage,
        apiSurface: metrics.apiSurface,
        busFactor: metrics.busFactor,
        dependencyCycles: metrics.dependencyCycles.length,
        docDensity: metrics.docDensity,
        duplicationPercentage: metrics.duplicationPercentage,
      },
      stats: {
        configFiles: metrics.configFiles,
        fileCount: metrics.fileCount,
        linesOfCode: metrics.totalLoc,
        totalSizeKb: metrics.totalSizeKb,
        totalSizeLabel: `${metrics.totalSizeKb} KB`,
      },
      summary: aiResult.executive_summary,
      teamRoles: metrics.teamRoles,
      topRisks: (aiResult.findings ?? []).slice(0, 3),
    };
  },

  toStructureMap(repo: RepoWithLatestAnalysisAndDocs) {
    return buildStructureMapPayload(repo);
  },

  toStructureNode(repo: RepoWithLatestAnalysisAndDocs, nodeId: string) {
    return buildStructureNodePayload(repo, nodeId);
  },

  toNodeExplain(repo: RepoWithLatestAnalysisAndDocs, nodeId: string) {
    return buildNodeExplainPayload(repo, nodeId);
  },
};
