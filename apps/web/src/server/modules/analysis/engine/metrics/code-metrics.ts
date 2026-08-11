import { lintSource } from "@secretlint/core";
import { creator as canaryPreset } from "@secretlint/secretlint-rule-preset-canary";
import { clamp, uniq } from "es-toolkit";
import { isExtensionSupported, parse } from "leasot";
import { normalize } from "pathe";
import sloc, { type Extension } from "sloc";

import { appLogger } from "@/server/core/app-logger";
import { taskLogger } from "@/server/modules/analysis/logic/task-logger";
import { normalizeLanguageName } from "@/server/utils/language-metadata";
import { getFileExtension } from "@/server/utils/path-operations";

import { calculateDocDensity } from "../core/common";
import type {
  RepositoryEvidence,
  SecretLintMessage,
  StructuralSignals,
} from "../core/discovery.types";
import { FactCollector } from "../core/fact-collector";
import { linguistStyleLabel } from "../core/file-classifier";
import type { RepoMetrics } from "../core/metrics.types";
import { collectStructuralSignals, scoreStructuralModularity } from "../core/structure";
import { collectPolyglotSignals } from "../extractors/language-signals";
import { OpenApiDiscoveryEngine } from "../extractors/openapi-inventory";
import { collectTypeScriptStaticHints } from "../extractors/ts-static-hints";
import {
  mergeRouteInventories,
  normalizeComplexityScore,
  normalizeTechDebtScore,
} from "./code-metric-formulas";
import {
  aggregateScanResults,
  type FileScanResult,
  type ScanAggregation,
} from "./code-metric-scan";
import { calculateRepositoryDuplication, type DuplicationReport } from "./duplication-metrics";

const secretLintConfig = {
  rules: [
    {
      id: canaryPreset.meta.id,
      options: {},
      rule: canaryPreset,
    },
  ],
};

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
  } catch (error) {
    appLogger.debug({
      error,
      msg: "Secret scan skipped after analyzer failure",
      path: normalizedPath,
    });
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
  } catch (error) {
    appLogger.debug({
      error,
      extension: extensionWithDot,
      msg: "TODO parsing skipped after analyzer failure",
      path: normalizedPath,
    });
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
  } catch (error) {
    appLogger.debug({
      error,
      extension,
      msg: "SLOC parser failed, using fallback line counting",
    });
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
  const sourceStats = collectSourceStats(file.content, extension);

  let complexity = 0;
  let maxNesting = 0;

  complexity = signal.complexityMetrics.complexity;
  maxNesting = signal.complexityMetrics.maxNesting;

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

function buildRepoMetrics(params: {
  duplicationReport: DuplicationReport;
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
    duplicationReport,
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
    duplicationPercentage: duplicationReport.duplicationPercentage,
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
    duplicationReport: duplicationReport,
    entrypointDetails: structuralSignals.entrypointDetails,
    entrypoints: structuralSignals.entrypoints,
    factCount: 0,
    fileCategoryBreakdown: structuralSignals.fileCategoryBreakdown,
    fileCount: files.length,
    findingCount: 0,
    frameworkFacts,
    graphPreviewEdges: structuralSignals.graphPreviewEdges,
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
    techStack: uniq([...techStack, ...frameworkFacts.map((fact) => fact.name)]).sort(
      (left, right) => left.localeCompare(right)
    ),
    totalLoc: scan.totals.source + scan.totals.comments,
    totalSizeKb: Math.round(scan.totals.size / 1024),
    tsStaticHints,
  };
}

export async function analyzeRepository(
  files: { content: string; path: string }[]
): Promise<{ evidence: RepositoryEvidence; metrics: RepoMetrics }> {
  taskLogger.info(`Metrics: Starting deep static analysis of ${files.length} files...`);

  const normalizedFiles = files.map((file) => ({
    content: file.content,
    path: normalize(file.path),
  }));
  const scanResults: FileScanResult[] = [];
  const batchSize = 8;
  let processedCount = 0;

  for (let index = 0; index < normalizedFiles.length; index += batchSize) {
    const batch = normalizedFiles.slice(index, index + batchSize);
    scanResults.push(...(await Promise.all(batch.map((file) => scanRepositoryFile(file)))));
    processedCount += batch.length;
    if (processedCount % 40 === 0 || processedCount === normalizedFiles.length) {
      taskLogger.info(`Metrics: Processed ${processedCount}/${normalizedFiles.length} files...`);
    }
  }

  const scan = aggregateScanResults(scanResults);

  taskLogger.info("Metrics: Building structural dependency graph...");
  const { evidence, structuralSignals } = await collectStructuralSignals(
    normalizedFiles,
    scan.fileComplexities,
    scan.fileSignalsByPath
  );

  const openapiInventory = OpenApiDiscoveryEngine.collect(normalizedFiles);
  const tsStaticHints = collectTypeScriptStaticHints(normalizedFiles);
  const duplicationReport = await calculateRepositoryDuplication(normalizedFiles);

  const frameworkFacts = structuralSignals.frameworkFacts.map((fact) => ({
    category: fact.category,
    confidence: fact.confidence,
    name: fact.name,
    sources: fact.sources,
  }));

  taskLogger.log("Detecting technologies and frameworks...");
  const techStack = FactCollector.collect(normalizedFiles, evidence, scan.fileSignalsByPath).map(
    (fact) => fact.name
  );

  const finalMetrics = buildRepoMetrics({
    duplicationReport,
    evidence,
    files: normalizedFiles,
    frameworkFacts,
    openapiInventory,
    scan,
    structuralSignals,
    techStack,
    tsStaticHints,
  });

  taskLogger.success(`Metrics engine finished. Stack detected: ${techStack.join(", ")}`);
  return { evidence, metrics: finalMetrics };
}

export async function calculateCodeMetrics(
  files: { content: string; path: string }[]
): Promise<RepoMetrics> {
  const { metrics } = await analyzeRepository(files);
  return metrics;
}
