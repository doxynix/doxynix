import path from "node:path";

import { getLanguageColor, normalizeLanguageName } from "@/shared/lib/utils";

import type { RepoMetrics } from "@/server/features/analyze-repo/lib/types";
import { normalizeRepoPath } from "@/server/shared/engine/core/common";
import {
  REPORT_FOCUS_SECTIONS,
  type FileCategory,
  type RepositoryEvidence,
} from "@/server/shared/engine/core/types";
import { dumpDebug } from "@/server/shared/lib/debug-logger";

import { cleanCodeForAi } from "../../../shared/lib/optimizers";

const HEAD_LINE_LIMIT = 12;
const MAX_HEAD_CHARS = 900;
const MAX_FILES_IN_TREE = 120;
const MAX_FOLDER_ROWS = 35;

type MapperFileEntry = {
  approxLines: number;
  head: string;
  isApiHeuristic: boolean;
  isConfig: boolean;
  linguistLabel: string;
  path: string;
  roleHint: string;
};

type MapperFolderAgg = {
  depth: number;
  fileCount: number;
  path: string;
};

type ModuleSnapshot = RepositoryEvidence["modules"][number];

const SECONDARY_EVIDENCE_CATEGORIES = new Set<FileCategory>([
  "asset",
  "benchmark",
  "config",
  "docs",
  "generated",
  "infra",
  "test",
  "tooling",
]);

const NON_ARCHITECTURE_CATEGORIES = new Set<FileCategory>([
  "asset",
  "benchmark",
  "docs",
  "generated",
  "test",
]);

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

function getFileExtension(filePath: string) {
  return path.posix.extname(filePath).replace(".", "").toLowerCase();
}

function linguistStyleLabel(filePath: string) {
  return (
    normalizeLanguageName(path.posix.extname(filePath)) ||
    normalizeLanguageName(getFileExtension(filePath))
  );
}

function isArchitectureRelevantModule(fileModule: ModuleSnapshot | undefined) {
  if (fileModule == null) return false;
  return (
    fileModule.categories.includes("runtime-source") &&
    !fileModule.categories.some((category) => NON_ARCHITECTURE_CATEGORIES.has(category))
  );
}

function isPrimaryArchitectureModule(fileModule: ModuleSnapshot | undefined) {
  if (!isArchitectureRelevantModule(fileModule)) return false;
  return (
    (fileModule?.categories.some((category) => SECONDARY_EVIDENCE_CATEGORIES.has(category)) ??
      true) === false
  );
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
  module: ModuleSnapshot | undefined,
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
  fileModule: ModuleSnapshot | undefined;
  isApiHeuristic: boolean;
  isConfig: boolean;
  lines: number;
  path: string;
  primaryEntrypointPaths: Set<string>;
}) {
  let score = Math.min(params.lines, 400) * 0.02;

  if (params.primaryEntrypointPaths.has(params.path)) score += 120;
  if (params.isConfig) score += 100;
  if (params.isApiHeuristic) score += 85;
  if (isPrimaryArchitectureModule(params.fileModule)) score += 70;
  else if (isArchitectureRelevantModule(params.fileModule)) score += 35;

  return score;
}

export function buildMapperSkeleton(
  files: { content: string; path: string }[],
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
        head,
        isApiHeuristic,
        isConfig,
        linguistLabel: linguistStyleLabel(file.path),
        path: file.path,
        roleHint: fileRoleHint(file.path, fileModule, isApiHeuristic, isConfig),
      } satisfies MapperFileEntry,
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
