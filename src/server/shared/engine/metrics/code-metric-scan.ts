import { getLanguageColor } from "../../lib/language-metadata";
import { percentile } from "../../lib/math-utils";
import type { FileSignals, LanguageMetric } from "../core/discovery.types";
import type { RepoMetrics } from "../core/metrics.types";
import { ProjectPolicy } from "../core/project-policy";
import { COMPLEXITY_SCORING, SCHEMA_LIMITS } from "../core/scoring-constants";

export type FileScanResult = {
  comments: number;
  complexity: number;
  maxNesting: number;
  normalizedPath: string;
  prettyName: string;
  securityFindings: RepoMetrics["securityFindings"];
  securityIssues: number;
  securityScanStatus: "ok" | "partial";
  signal: FileSignals;
  size: number;
  source: number;
  todos: number;
};

export type ScanAggregation = {
  analysisCoverage: RepoMetrics["analysisCoverage"];
  fileComplexities: Array<{ path: string; score: number }>;
  fileSignalsByPath: Map<string, FileSignals>;
  languages: LanguageMetric[];
  mostComplexFiles: string[];
  securityFindings: RepoMetrics["securityFindings"];
  securityScanStatus: RepoMetrics["securityScanStatus"];
  totals: {
    comments: number;
    maxNesting: number;
    securityIssues: number;
    size: number;
    source: number;
    todos: number;
  };
};

function buildAnalysisCoverage(
  results: FileScanResult[],
  totalFiles: number
): RepoMetrics["analysisCoverage"] {
  const languagesByMode = {
    heuristic: new Set<string>(),
    treeSitter: new Set<string>(),
    typeScriptAst: new Set<string>(),
  };

  for (const result of results) {
    if (result.signal.analysisMode === "typescript-ast") {
      languagesByMode.typeScriptAst.add(result.prettyName);
    } else if (result.signal.analysisMode === "tree-sitter") {
      languagesByMode.treeSitter.add(result.prettyName);
    } else {
      languagesByMode.heuristic.add(result.prettyName);
    }
  }

  const typeScriptAstFiles = results.filter(
    (result) => result.signal.analysisMode === "typescript-ast"
  ).length;
  const treeSitterFiles = results.filter(
    (result) => result.signal.analysisMode === "tree-sitter"
  ).length;
  const heuristicFiles = Math.max(0, totalFiles - typeScriptAstFiles - treeSitterFiles);

  return {
    heuristicFiles,
    languagesByMode: {
      heuristic: Array.from(languagesByMode.heuristic).sort((left, right) =>
        left.localeCompare(right)
      ),
      treeSitter: Array.from(languagesByMode.treeSitter).sort((left, right) =>
        left.localeCompare(right)
      ),
      typeScriptAst: Array.from(languagesByMode.typeScriptAst).sort((left, right) =>
        left.localeCompare(right)
      ),
    },
    parserCoveragePercent:
      totalFiles === 0
        ? 0
        : Math.round(((typeScriptAstFiles + treeSitterFiles) / totalFiles) * 100),
    totalFiles,
    treeSitterFiles,
    typeScriptAstFiles,
  };
}

export function aggregateScanResults(results: FileScanResult[]): ScanAggregation {
  const fileComplexities = results.map((result) => ({
    path: result.normalizedPath,
    score: result.complexity,
  }));
  const langStats = results.reduce<Record<string, number>>((acc, result) => {
    acc[result.prettyName] = (acc[result.prettyName] ?? 0) + result.source;
    return acc;
  }, {});
  const rankedComplexities = [...fileComplexities].sort((left, right) => right.score - left.score);
  const focusedThreshold = Math.max(
    8,
    percentile(
      rankedComplexities
        .filter((item) => ProjectPolicy.isUsefulComplexityCandidate(item.path))
        .map((item) => item.score),
      COMPLEXITY_SCORING.percentileThreshold
    )
  );
  const focusedComplexFiles = rankedComplexities
    .filter((item) => item.score >= focusedThreshold)
    .map((item) => item.path)
    .filter((path) => ProjectPolicy.isUsefulComplexityCandidate(path));
  const fallbackComplexFiles = rankedComplexities
    .map((item) => item.path)
    .filter((path) => ProjectPolicy.isUsefulComplexityCandidate(path));
  const mostComplexFiles = (
    focusedComplexFiles.length > 0 ? focusedComplexFiles : fallbackComplexFiles
  ).slice(0, SCHEMA_LIMITS.maxFilesToSkeletonize);

  return {
    analysisCoverage: buildAnalysisCoverage(results, results.length),
    fileComplexities,
    fileSignalsByPath: new Map(results.map((result) => [result.normalizedPath, result.signal])),
    languages: Object.entries(langStats)
      .map(([name, lines]) => ({
        color: getLanguageColor(name) || "#cccccc",
        lines,
        name,
      }))
      .sort((left, right) => right.lines - left.lines),
    mostComplexFiles,
    securityFindings: results.flatMap((result) => result.securityFindings),
    securityScanStatus: results.some((result) => result.securityScanStatus === "partial")
      ? "partial"
      : "ok",
    totals: results.reduce(
      (acc, result) => ({
        comments: acc.comments + result.comments,
        maxNesting: Math.max(acc.maxNesting, result.maxNesting),
        securityIssues: acc.securityIssues + result.securityIssues,
        size: acc.size + result.size,
        source: acc.source + result.source,
        todos: acc.todos + result.todos,
      }),
      {
        comments: 0,
        maxNesting: 0,
        securityIssues: 0,
        size: 0,
        source: 0,
        todos: 0,
      }
    ),
  };
}
