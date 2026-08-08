import { normalize } from "pathe";

import type { ModuleRef, RepositoryEvidence } from "../engine/core/discovery.types";
import { REPORT_FOCUS_SECTIONS } from "../engine/core/documentation.types";
import type { RepoMetrics } from "../engine/core/metrics.types";
import { ProjectPolicy } from "../engine/core/project-policy";
import { MAPPER_FILE_SCORING } from "../engine/core/scoring-constants";
import type { RepositoryModuleFile } from "./context-manager";

const MAX_FILES_IN_TREE = 1000;
const MAX_FOLDER_ROWS = 100;

type MapperFolderAgg = {
  depth: number;
  fileCount: number;
  path: string;
};

type SelectedFileEntry = {
  loc?: number;
  p: string;
  role: string;
};

type CompactInternalEdge = {
  f: string;
  t: string;
};

type CompactModuleAdjacency = {
  in: string[];
  out: string[];
  p: string;
};

function topFolderPrefixes(paths: string[]): MapperFolderAgg[] {
  const counts = new Map<string, number>();
  for (const p of paths) {
    const parts = p.split("/").filter(Boolean);
    if (parts.length <= 1) continue;
    const top = parts[0]!;
    counts.set(top, (counts.get(top) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .filter(([, fileCount]) => fileCount > 2)
    .slice(0, MAX_FOLDER_ROWS)
    .map(([top, fileCount]) => ({
      depth: 1,
      fileCount,
      path: top,
    }));
}

function isArchitectureRelevantModule(fileModule: ModuleRef | undefined) {
  if (fileModule == null) return false;
  return ProjectPolicy.isArchitectureRelevantCategories(fileModule.categories);
}

function isPrimaryArchitectureModule(fileModule: ModuleRef | undefined) {
  if (fileModule == null) return false;
  if (!isArchitectureRelevantModule(fileModule)) return false;
  return ProjectPolicy.isPrimaryArchitectureCategories(fileModule.categories);
}

function buildEvidenceMaps(evidence: RepositoryEvidence, metrics: RepoMetrics) {
  const moduleByPath = new Map(evidence.modules.map((module) => [module.path, module] as const));
  const configPaths = new Set(evidence.configs.map((config) => config.path));
  const apiSourcePaths = new Set([
    ...evidence.routes.map((route) => route.sourcePath),
    ...evidence.routeInventory.sourceFiles,
    ...(metrics.openapiInventory?.sourceFiles ?? []),
  ]);
  const primaryEntrypointPaths = new Set(
    evidence.entrypoints
      .filter((entrypoint) => entrypoint.kind === "library" || entrypoint.kind === "runtime")
      .map((entrypoint) => entrypoint.path)
  );

  return {
    apiSourcePaths,
    configPaths,
    moduleByPath,
    primaryEntrypointPaths,
  };
}

function fileRoleHint(
  filePath: string,
  module: ModuleRef | undefined,
  isApiHeuristic: boolean,
  isConfig: boolean
): string {
  if (isConfig) return "config";
  if (isApiHeuristic) return "api";
  if (module?.categories.includes("test") ?? false) return "test";
  const lower = filePath.toLowerCase();
  if (lower.includes("/server/") || lower.includes("/api/")) return "server";
  if (lower.includes("/client/") || lower.includes("/ui/") || lower.includes("/components/")) {
    return "ui";
  }
  if (isPrimaryArchitectureModule(module)) return "source";
  return (module?.categories.includes("runtime-source") ?? false) ? "runtime-support" : "source";
}

function scoreFileCandidate(params: {
  fileModule: ModuleRef | undefined;
  isApiHeuristic: boolean;
  isConfig: boolean;
  lines: number;
  path: string;
  primaryEntrypointPaths: Set<string>;
}) {
  let score =
    Math.min(params.lines, MAPPER_FILE_SCORING.maxLinesForLineScore) *
    MAPPER_FILE_SCORING.lineMultiplier;

  if (params.primaryEntrypointPaths.has(params.path))
    score += MAPPER_FILE_SCORING.primaryEntrypointBonus;
  if (params.isConfig) score += MAPPER_FILE_SCORING.configFileBonus;
  if (params.isApiHeuristic) score += MAPPER_FILE_SCORING.apiHeuristicBonus;
  if (isPrimaryArchitectureModule(params.fileModule))
    score += MAPPER_FILE_SCORING.primaryArchitectureBonus;
  else if (isArchitectureRelevantModule(params.fileModule))
    score += MAPPER_FILE_SCORING.secondaryArchitectureBonus;

  return score;
}

function pushUnique(items: string[], value: string, limit: number) {
  if (items.length >= limit) return;
  if (!items.includes(value)) items.push(value);
}

function isResolvedInternalEdge(
  edge: RepositoryEvidence["dependencyGraph"]["edges"][number]
): edge is RepositoryEvidence["dependencyGraph"]["edges"][number] & { toPath: string } {
  return edge.kind === "internal" && edge.resolved && edge.toPath != null;
}

function buildDependencyTopology(
  evidence: RepositoryEvidence,
  modulePaths: string[],
  selectedFilePaths: Set<string>
) {
  const modulePathSet = new Set(modulePaths);
  const relevantPathSet = new Set([...modulePathSet, ...selectedFilePaths]);

  const internalEdges = evidence.dependencyGraph.edges.filter(isResolvedInternalEdge);

  const rankedEdges = internalEdges
    .map((edge) => {
      let score = 0;
      if (relevantPathSet.has(edge.fromPath)) score += 8;
      if (relevantPathSet.has(edge.toPath)) score += 8;
      if (modulePathSet.has(edge.fromPath)) score += 12;
      if (modulePathSet.has(edge.toPath)) score += 12;
      return { edge, score };
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.edge.fromPath.localeCompare(right.edge.fromPath) ||
        left.edge.toPath.localeCompare(right.edge.toPath)
    );

  const compactEdges: CompactInternalEdge[] = rankedEdges.slice(0, 120).map(({ edge }) => ({
    f: edge.fromPath,
    t: edge.toPath,
  }));

  const adjacencyByPath = new Map<string, CompactModuleAdjacency>(
    modulePaths.map((path) => [path, { in: [], out: [], p: path }])
  );

  for (const edge of internalEdges) {
    const fromEntry = adjacencyByPath.get(edge.fromPath);
    if (fromEntry != null) pushUnique(fromEntry.out, edge.toPath, 12);

    const toEntry = adjacencyByPath.get(edge.toPath);
    if (toEntry != null) pushUnique(toEntry.in, edge.fromPath, 12);
  }

  return {
    internalEdges: compactEdges,
    moduleAdjacency: [...adjacencyByPath.values()].filter(
      (entry) => entry.in.length > 0 || entry.out.length > 0
    ),
    omittedInternalEdges: Math.max(0, internalEdges.length - compactEdges.length),
  };
}

export function buildMapperSkeleton(
  files: RepositoryModuleFile[],
  metrics: RepoMetrics,
  evidence: RepositoryEvidence
): string {
  const normalized = files.map((f) => ({
    content: f.content,
    path: normalize(f.path),
  }));

  const { apiSourcePaths, configPaths, moduleByPath, primaryEntrypointPaths } = buildEvidenceMaps(
    evidence,
    metrics
  );

  const scored = normalized.map((file) => {
    const lines = file.content?.split(/\r?\n/u).length;

    const fileModule = moduleByPath.get(file.path);
    const isConfig = configPaths.has(file.path);
    const isApiHeuristic = apiSourcePaths.has(file.path) || (fileModule?.routeCount ?? 0) > 0;

    return {
      approxLines: lines,
      entry: {
        loc: lines,
        p: file.path,
        role: fileRoleHint(file.path, fileModule, isApiHeuristic, isConfig),
      } satisfies SelectedFileEntry,
      score: scoreFileCandidate({
        fileModule,
        isApiHeuristic,
        isConfig,
        lines: lines ?? 0,
        path: file.path,
        primaryEntrypointPaths,
      }),
    };
  });

  scored.sort((a, b) => b.score - a.score);

  const picked = scored
    .filter((s) => {
      const loc = s.entry.loc ?? 0;

      return loc > 5;
    })
    .slice(0, MAX_FILES_IN_TREE)
    .map((s) => s.entry);

  const allPaths = normalized.map((f) => f.path);

  const graphReliability = evidence.dependencyGraph;
  const graphReliabilitySummary = {
    resolvedEdges: graphReliability.resolvedEdges,
    unresolvedImportSpecifiers: graphReliability.unresolvedImportSpecifiers,
    unresolvedSamples: graphReliability.unresolvedSamples.slice(0, 8),
  };
  const openapiInventory = metrics.openapiInventory ?? {
    estimatedOperations: 0,
    pathPatterns: [],
    sourceFiles: [],
  };
  const routeInventory = metrics.routeInventory ?? evidence.routeInventory;
  const churnHotspots = metrics.churnHotspots ?? [];
  const tsStaticHints = metrics.tsStaticHints ?? [];

  const compactedCoverage = {
    heuristicFiles: metrics.analysisCoverage.heuristicFiles,
    parserCoveragePercent: metrics.analysisCoverage.parserCoveragePercent,
    totalFiles: metrics.analysisCoverage.totalFiles,
    treeSitterFiles: metrics.analysisCoverage.treeSitterFiles,
    typeScriptAstFiles: metrics.analysisCoverage.typeScriptAstFiles,
  };

  const compactedFrameworkFacts = evidence.frameworkFacts.map((fact) => ({
    category: fact.category,
    confidence: fact.confidence,
    name: fact.name,
  }));

  const compactedRouteInventory = {
    estimatedOperations: routeInventory.estimatedOperations,
    frameworks: routeInventory.frameworks,
  };

  const modules = evidence.modules
    .filter((module) => isArchitectureRelevantModule(module))
    .sort(
      (left, right) =>
        right.apiSurface - left.apiSurface ||
        right.routeCount - left.routeCount ||
        right.exports - left.exports ||
        left.path.localeCompare(right.path)
    )
    .slice(0, 36)
    .map((module) => ({
      apiSurface: module.apiSurface,
      exports: module.exports,
      path: module.path,
      routeCount: module.routeCount,
    }));

  const dependencyTopology = buildDependencyTopology(
    evidence,
    modules.map((module) => module.path),
    new Set(picked.map((file) => file.p))
  );

  const payload = {
    analysisCoverage: compactedCoverage,
    churnHotspots: churnHotspots.slice(0, 8),
    dependencyHotspots: metrics.dependencyHotspots.slice(0, 8),
    dependencyTopology,
    entrypointDetails: evidence.entrypoints,
    fileCategoryBreakdown: evidence.fileCategoryBreakdown,
    files: picked,
    folderSummary: topFolderPrefixes(allPaths),
    frameworkFacts: compactedFrameworkFacts,
    graphReliability: graphReliabilitySummary,
    languages: metrics.languages.map((l) => ({
      lines: l.lines,
      name: l.name,
    })),
    modules,
    openapiInventory,
    reportFocus: [...REPORT_FOCUS_SECTIONS],
    routeInventory: compactedRouteInventory,
    techStack: metrics.techStack.slice(0, 24),
    tsStaticHints: tsStaticHints.slice(0, 12),
  };

  return JSON.stringify(payload);
}
