import { getLanguageColor } from "@/shared/lib/utils";

import { getFileExtension, normalizeRepoPath } from "@/server/shared/engine/core/common";
import type {
  Module,
  ModuleRef,
  RepositoryEvidence,
} from "@/server/shared/engine/core/discovery.types";
import { REPORT_FOCUS_SECTIONS } from "@/server/shared/engine/core/documentation.types";
import { linguistStyleLabel } from "@/server/shared/engine/core/file-classifier";
import type { RepoMetrics } from "@/server/shared/engine/core/metrics.types";
import { ProjectPolicy } from "@/server/shared/engine/core/project-policy";
import { MAPPER_FILE_SCORING } from "@/server/shared/engine/core/scoring-constants";
import { dumpDebug } from "@/server/shared/lib/debug-logger";
import { cleanCodeForAi } from "@/server/shared/lib/optimizers";

const HEAD_LINE_LIMIT = 12;
const MAX_HEAD_CHARS = 900;
const MAX_FILES_IN_TREE = 120;
const MAX_FOLDER_ROWS = 35;

type MapperFolderAgg = {
  depth: number;
  fileCount: number;
  path: string;
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

// Local wrapper for linguistStyleLabel with sensible fallback
function fileLanguageLabel(filePath: string): string {
  const ext = getFileExtension(filePath);
  const fallback = ext ? ext.slice(1).toUpperCase() : "Unknown";
  return linguistStyleLabel(filePath, fallback);
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

export function buildMapperSkeleton(
  files: Module[],
  metrics: RepoMetrics,
  evidence: RepositoryEvidence
): string {
  const normalized = files.map((f) => ({
    content: f.content,
    path: normalizeRepoPath(f.path),
  }));

  const { apiSourcePaths, configPaths, moduleByPath, primaryEntrypointPaths } = buildEvidenceMaps(
    evidence,
    metrics
  );

  const scored = normalized.map((file) => {
    const lines = file.content.split(/\r?\n/u).length;
    const clean = cleanCodeForAi(file.content, file.path);
    const headLines = clean.split(/\r?\n/u).slice(0, HEAD_LINE_LIMIT);
    let head = headLines.join("\n");
    if (head.length > MAX_HEAD_CHARS) head = `${head.slice(0, MAX_HEAD_CHARS)}…`;

    const fileModule = moduleByPath.get(file.path);
    const isConfig = configPaths.has(file.path);
    const isApiHeuristic = apiSourcePaths.has(file.path) || (fileModule?.routeCount ?? 0) > 0;

    return {
      approxLines: lines,
      entry: {
        approxLines: lines,
        content: file.content,
        head,
        isApiHeuristic,
        isConfig,
        linguistLabel: fileLanguageLabel(file.path),
        path: file.path,
        roleHint: fileRoleHint(file.path, fileModule, isApiHeuristic, isConfig),
      } satisfies Module,
      score: scoreFileCandidate({
        fileModule,
        isApiHeuristic,
        isConfig,
        lines,
        path: file.path,
        primaryEntrypointPaths,
      }),
    };
  });

  scored.sort((a, b) => b.score - a.score);
  const picked = scored.slice(0, MAX_FILES_IN_TREE).map((s) => s.entry);
  const allPaths = normalized.map((f) => f.path);

  const graphReliability = evidence.dependencyGraph;
  const openapiInventory = metrics.openapiInventory ?? {
    estimatedOperations: 0,
    pathPatterns: [],
    sourceFiles: [],
  };
  const routeInventory = metrics.routeInventory ?? evidence.routeInventory;
  const churnHotspots = metrics.churnHotspots ?? [];
  const tsStaticHints = metrics.tsStaticHints ?? [];

  const payload = {
    analysisCoverage: metrics.analysisCoverage,
    churnHotspots: churnHotspots.slice(0, 8),
    dependencyHotspots: metrics.dependencyHotspots.slice(0, 8),
    entrypointDetails: evidence.entrypoints,
    entrypoints: Array.from(primaryEntrypointPaths).sort((left, right) =>
      left.localeCompare(right)
    ),
    fileCategoryBreakdown: evidence.fileCategoryBreakdown,
    files: picked,
    folderSummary: topFolderPrefixes(allPaths),
    frameworkFacts: evidence.frameworkFacts,
    graphReliability,
    languages: metrics.languages.map((l) => ({
      color: l.color || getLanguageColor(l.name),
      lines: l.lines,
      name: l.name,
    })),
    modules: evidence.modules
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
        categories: module.categories,
        exports: module.exports,
        parseTier: module.parseTier,
        path: module.path,
        routeCount: module.routeCount,
      })),
    openapiInventory,
    reportFocus: [...REPORT_FOCUS_SECTIONS],
    routeInventory,
    techStack: metrics.techStack.slice(0, 24),
    tsStaticHints: tsStaticHints.slice(0, 12),
  };

  dumpDebug("mapper-skeleton-payload", payload);

  return JSON.stringify(payload, null, 2);
}
