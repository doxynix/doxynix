import { lintSource } from "@secretlint/core";
import { creator as canaryPreset } from "@secretlint/secretlint-rule-preset-canary";
import { isExtensionSupported, parse } from "leasot";
import sloc, { type Extension } from "sloc";

import { getLanguageColor, normalizeLanguageName } from "@/shared/lib/utils";

import { dumpDebug } from "@/server/utils/debug-logger";

import { calculateDocDensity, clamp, normalizeRepoPath } from "../core/common";
import { FactCollector } from "../core/fact-collector";
import { FileClassifier, linguistStyleLabel } from "../core/file-classifier";
import { collectStructuralSignals, scoreStructuralModularity } from "../core/structure";
import type {
  FileSignals,
  LanguageMetric,
  RepoMetrics,
  RepositoryEvidence,
  SecretLintMessage,
  StructuralSignals,
} from "../core/types";
import { collectPolyglotSignals } from "../extractors/language-signals";
import { collectOpenApiInventory } from "../extractors/openapi-inventory";
import { collectTypeScriptStaticHints } from "../extractors/ts-static-hints";
import { calculateApproximateDuplication } from "./common-metrics";
import { calculateComplexity } from "./complexity";

const secretLintConfig = {
  rules: [
    {
      id: canaryPreset.meta.id,
      options: {},
      rule: canaryPreset,
    },
  ],
};

type FileScanResult = {
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

type ScanAggregation = {
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

function getFileExtension(filePath: string) {
  const normalizedPath = filePath.replace(/\\/g, "/");
  const filename = normalizedPath.slice(normalizedPath.lastIndexOf("/") + 1);
  const dotIndex = filename.lastIndexOf(".");
  return dotIndex >= 0 ? filename.slice(dotIndex).toLowerCase() : "";
}

function percentile(values: number[], ratio: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * ratio)));
  return sorted[index] ?? 0;
}

function normalizeComplexityScore(params: {
  cycles: number;
  fileCount: number;
  maxNesting: number;
  scores: number[];
}) {
  const average =
    params.fileCount === 0
      ? 0
      : params.scores.reduce((sum, value) => sum + value, 0) / params.fileCount;
  const p85 = percentile(params.scores, 0.85);
  const highComplexityThreshold = Math.max(12, p85);
  const highComplexityFiles = params.scores.filter(
    (score) => score >= highComplexityThreshold
  ).length;
  const hotspotRatio = params.fileCount === 0 ? 0 : highComplexityFiles / params.fileCount;

  const averagePenalty = clamp(average * 1.6, 0, 34);
  const nestingPenalty = clamp(params.maxNesting * 3, 0, 20);
  const cyclePenalty = clamp(params.cycles * 8, 0, 24);
  const hotspotPenalty = clamp(hotspotRatio * 30, 0, 22);

  return clamp(
    Math.round(100 - averagePenalty - nestingPenalty - cyclePenalty - hotspotPenalty),
    0,
    100
  );
}

function normalizeTechDebtScore(params: {
  dependencyCycles: number;
  duplicationPercentage: number;
  fileCount: number;
  orphanModules: number;
  todos: number;
}) {
  const todoDensity = params.fileCount === 0 ? 0 : params.todos / params.fileCount;
  const orphanRatio = params.fileCount === 0 ? 0 : params.orphanModules / params.fileCount;

  const todoPenalty = clamp(todoDensity * 3, 0, 18);
  const duplicationPenalty = clamp(params.duplicationPercentage * 1.8, 0, 28);
  const cyclePenalty = clamp(params.dependencyCycles * 7, 0, 22);
  const orphanPenalty = clamp(orphanRatio * 100 * 0.35, 0, 18);

  return clamp(
    Math.round(100 - todoPenalty - duplicationPenalty - cyclePenalty - orphanPenalty),
    0,
    100
  );
}

function mergeRouteInventories(
  extracted: RepoMetrics["routeInventory"] | undefined,
  openapiInventory: RepoMetrics["openapiInventory"]
): NonNullable<RepoMetrics["routeInventory"]> {
  const extractedInventory =
    extracted ??
    ({
      estimatedOperations: 0,
      frameworks: [],
      httpRoutes: [],
      rpcProcedures: 0,
      source: "extracted",
      sourceFiles: [],
    } satisfies NonNullable<RepoMetrics["routeInventory"]>);

  if (openapiInventory == null || openapiInventory.sourceFiles.length === 0) {
    return extractedInventory;
  }

  const combinedFrameworks = Array.from(
    new Set([
      ...extractedInventory.frameworks,
      ...(openapiInventory.sourceFiles.length > 0 ? ["OpenAPI"] : []),
    ])
  );

  return {
    estimatedOperations: Math.max(
      extractedInventory.estimatedOperations,
      openapiInventory.estimatedOperations
    ),
    frameworks: combinedFrameworks,
    httpRoutes: extractedInventory.httpRoutes,
    rpcProcedures: extractedInventory.rpcProcedures,
    source:
      extractedInventory.estimatedOperations > 0 && openapiInventory.estimatedOperations > 0
        ? "mixed"
        : "openapi",
    sourceFiles: Array.from(
      new Set([...extractedInventory.sourceFiles, ...openapiInventory.sourceFiles])
    ).sort((a, b) => a.localeCompare(b)),
  };
}

async function collectSecuritySignals(normalizedPath: string, content: string) {
  try {
    const result = await lintSource({
      options: { config: secretLintConfig },
      source: {
        content,
        contentType: "text",
        filePath: normalizedPath,
      },
    });

    const relevantMessages = (result.messages as SecretLintMessage[]).filter(
      (message) => message.severity === "error" || message.severity === "warning"
    );

    return {
      findings: relevantMessages.map((message) => ({
        line: typeof message.line === "number" ? message.line : undefined,
        message: message.message,
        path: normalizedPath,
        severity: (message.severity === "error" ? "error" : "warning") as "error" | "warning",
      })),
      issueCount: relevantMessages.length,
      status: "ok" as const,
    };
  } catch {
    return {
      findings: [] as RepoMetrics["securityFindings"],
      issueCount: 0,
      status: "partial" as const,
    };
  }
}

async function collectTodoCount(content: string, extensionWithDot: string, normalizedPath: string) {
  if (extensionWithDot === "" || !isExtensionSupported(extensionWithDot)) {
    return 0;
  }

  try {
    const todos = await parse(content, {
      extension: extensionWithDot,
      filename: normalizedPath,
    });
    return todos.length;
  } catch {
    return 0;
  }
}

function collectSourceStats(content: string, extension: string) {
  try {
    const slocExt = extension as Extension;
    if (sloc.extensions.includes(slocExt)) {
      const stats = sloc(content, slocExt);
      return {
        comments: stats.comment,
        source: stats.source,
      };
    }
  } catch {
    // Fall back to rough line counting below.
  }

  const lines = content.split(/\r?\n/u).length;
  return {
    comments: 0,
    source: lines,
  };
}

async function scanRepositoryFile(file: {
  content: string;
  path: string;
}): Promise<FileScanResult> {
  const extension = getFileExtension(file.path).replace(".", "");
  const prettyName = linguistStyleLabel(file.path, normalizeLanguageName(extension));
  const extWithDot = extension === "" ? "" : `.${extension}`;
  const signal = await collectPolyglotSignals(file);
  const security = await collectSecuritySignals(file.path, file.content);
  const todos = await collectTodoCount(file.content, extWithDot, file.path);
  const { complexity, maxNesting } = calculateComplexity(file.content, file.path);
  const sourceStats = collectSourceStats(file.content, extension);

  return {
    comments: sourceStats.comments,
    complexity,
    maxNesting,
    normalizedPath: file.path,
    prettyName,
    securityFindings: security.findings,
    securityIssues: security.issueCount,
    securityScanStatus: security.status,
    signal,
    size: file.content.length,
    source: sourceStats.source,
    todos,
  };
}

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

function aggregateScanResults(results: FileScanResult[]): ScanAggregation {
  const fileComplexities = results.map((result) => ({
    path: result.normalizedPath,
    score: result.complexity,
  }));
  const langStats = results.reduce<Record<string, number>>((acc, result) => {
    acc[result.prettyName] = (acc[result.prettyName] ?? 0) + result.source;
    return acc;
  }, {});
  const mostComplexFiles = [...fileComplexities]
    .sort((left, right) => right.score - left.score)
    .map((item) => item.path)
    .filter((path) => !FileClassifier.isPrimaryContourExcluded(path));

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

function buildRepoMetrics(params: {
  duplicationPercentage: number;
  evidence: RepositoryEvidence;
  files: { content: string; path: string }[];
  frameworkFacts: NonNullable<RepoMetrics["frameworkFacts"]>;
  openapiInventory: RepoMetrics["openapiInventory"];
  scan: ScanAggregation;
  structuralSignals: StructuralSignals;
  techStack: string[];
  tsStaticHints: RepoMetrics["tsStaticHints"];
}): RepoMetrics {
  const {
    duplicationPercentage,
    files,
    frameworkFacts,
    openapiInventory,
    scan,
    structuralSignals,
    techStack,
    tsStaticHints,
  } = params;
  const complexityValues = scan.fileComplexities.map((item) => item.score);
  const routeInventory: NonNullable<RepoMetrics["routeInventory"]> = mergeRouteInventories(
    structuralSignals.routeInventory,
    openapiInventory
  );
  const complexityScore = normalizeComplexityScore({
    cycles: structuralSignals.dependencyCycles.length,
    fileCount: files.length,
    maxNesting: scan.totals.maxNesting,
    scores: complexityValues,
  });
  const techDebtScore = normalizeTechDebtScore({
    dependencyCycles: structuralSignals.dependencyCycles.length,
    duplicationPercentage,
    fileCount: files.length,
    orphanModules: structuralSignals.orphanModules.length,
    todos: scan.totals.todos,
  });
  const securityScore = clamp(
    scan.securityScanStatus === "partial"
      ? Math.min(60, 100 - scan.totals.securityIssues * 12)
      : 100 - scan.totals.securityIssues * 12,
    0,
    100
  );

  return {
    analysisCoverage: scan.analysisCoverage,
    apiSurface: Math.max(structuralSignals.apiSurface, routeInventory.estimatedOperations),
    busFactor: 0,
    changeCoupling: [],
    churnHotspots: [],
    complexityScore,
    configFiles: structuralSignals.configInventory.length,
    configInventory: structuralSignals.configInventory,
    dependencyCycles: structuralSignals.dependencyCycles,
    dependencyHotspots: structuralSignals.dependencyHotspots,
    docDensity: calculateDocDensity(scan.totals.source, scan.totals.comments),
    documentationInput: undefined,
    duplicationPercentage: Math.round(duplicationPercentage),
    entrypointDetails: structuralSignals.entrypointDetails,
    entrypoints: structuralSignals.entrypoints,
    factCount: 0,
    fileCategoryBreakdown: structuralSignals.fileCategoryBreakdown,
    fileCount: files.length,
    findingCount: 0,
    frameworkFacts,
    graphReliability: structuralSignals.graphReliability,
    healthScore: 0,
    hotspotFiles: structuralSignals.hotspotFiles,
    hotspotSignals: structuralSignals.hotspotSignals,
    languages: scan.languages,
    maintenanceStatus: "active",
    modularityIndex: scoreStructuralModularity({
      dependencyCycles: structuralSignals.dependencyCycles,
      dependencyHotspots: structuralSignals.dependencyHotspots,
      orphanModules: structuralSignals.orphanModules,
    }),
    mostComplexFiles: scan.mostComplexFiles,
    onboardingScore: 0,
    openapiInventory,
    orphanModules: structuralSignals.orphanModules,
    publicExports: structuralSignals.publicExports,
    routeInventory,
    securityFindings: scan.securityFindings,
    securityScanStatus: scan.securityScanStatus,
    securityScore,
    teamRoles: [],
    techDebtScore,
    techStack: Array.from(new Set([...techStack, ...frameworkFacts.map((fact) => fact.name)])).sort(
      (left, right) => left.localeCompare(right)
    ),
    totalLoc: scan.totals.source + scan.totals.comments,
    totalSizeKb: Math.round(scan.totals.size / 1024),
    tsStaticHints,
  };
}

// Main backend analysis entrypoint: turns repository files into canonical evidence plus derived metrics.
export async function analyzeRepository(
  files: { content: string; path: string }[]
): Promise<{ evidence: RepositoryEvidence; metrics: RepoMetrics }> {
  const normalizedFiles = files.map((file) => ({
    content: file.content,
    path: normalizeRepoPath(file.path),
  }));
  const scanResults: FileScanResult[] = [];
  const batchSize = 8;

  for (let index = 0; index < normalizedFiles.length; index += batchSize) {
    const batch = normalizedFiles.slice(index, index + batchSize);
    scanResults.push(...(await Promise.all(batch.map((file) => scanRepositoryFile(file)))));
  }

  const scan = aggregateScanResults(scanResults);

  const { evidence, structuralSignals } = await collectStructuralSignals(
    normalizedFiles,
    scan.fileComplexities,
    scan.fileSignalsByPath
  );
  const openapiInventory = collectOpenApiInventory(normalizedFiles);
  const tsStaticHints = collectTypeScriptStaticHints(normalizedFiles);
  const duplicatedLines = calculateApproximateDuplication(normalizedFiles);
  const duplicationPercentage =
    scan.totals.source > 0 ? (duplicatedLines / scan.totals.source) * 100 : 0;
  const frameworkFacts = structuralSignals.frameworkFacts.map((fact) => ({
    category: fact.category,
    confidence: fact.confidence,
    name: fact.name,
    sources: fact.sources,
  }));
  const techStack = FactCollector.collect(normalizedFiles, evidence, scan.fileSignalsByPath).map(
    (fact) => fact.name
  );

  const finalMetrics = buildRepoMetrics({
    duplicationPercentage,
    evidence,
    files: normalizedFiles,
    frameworkFacts,
    openapiInventory,
    scan,
    structuralSignals,
    techStack,
    tsStaticHints,
  });

  dumpDebug("full-metrics-output", finalMetrics);
  return { evidence, metrics: finalMetrics };
}

export async function calculateCodeMetrics(
  files: { content: string; path: string }[]
): Promise<RepoMetrics> {
  const { metrics } = await analyzeRepository(files);
  return metrics;
}
