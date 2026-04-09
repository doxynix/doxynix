import { clamp } from "../core/common";
import type { RepoMetrics } from "../core/metrics.types";
import { COMPLEXITY_SCORING, TECH_DEBT_SCORING } from "../core/scoring-constants";

function percentile(values: number[], ratio: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * ratio)));
  return sorted[index] ?? 0;
}

export function normalizeComplexityScore(params: {
  cycles: number;
  fileCount: number;
  maxNesting: number;
  scores: number[];
}) {
  const average =
    params.fileCount === 0
      ? 0
      : params.scores.reduce((sum, value) => sum + value, 0) / params.fileCount;
  const p85 = percentile(params.scores, COMPLEXITY_SCORING.percentileThreshold);
  const highComplexityThreshold = Math.max(COMPLEXITY_SCORING.minComplexityThreshold, p85);
  const highComplexityFiles = params.scores.filter(
    (score) => score >= highComplexityThreshold
  ).length;
  const hotspotRatio = params.fileCount === 0 ? 0 : highComplexityFiles / params.fileCount;

  const averagePenalty = clamp(
    average * COMPLEXITY_SCORING.averageComplexityMultiplier,
    0,
    COMPLEXITY_SCORING.averagePenaltyMax
  );
  const nestingPenalty = clamp(
    params.maxNesting * COMPLEXITY_SCORING.nestingDepthMultiplier,
    0,
    COMPLEXITY_SCORING.maxNestingPenaltyMax
  );
  const cyclePenalty = clamp(
    params.cycles * COMPLEXITY_SCORING.cycleMultiplier,
    0,
    COMPLEXITY_SCORING.cyclePenaltyMax
  );
  const hotspotPenalty = clamp(
    hotspotRatio * COMPLEXITY_SCORING.hotspotRatioMultiplier,
    0,
    COMPLEXITY_SCORING.hotspotRatioPenaltyMax
  );

  return clamp(
    Math.round(100 - averagePenalty - nestingPenalty - cyclePenalty - hotspotPenalty),
    0,
    100
  );
}

export function normalizeTechDebtScore(params: {
  dependencyCycles: number;
  duplicationPercentage: number;
  fileCount: number;
  orphanModules: number;
  todos: number;
}) {
  const todoDensity = params.fileCount === 0 ? 0 : params.todos / params.fileCount;
  const orphanRatio = params.fileCount === 0 ? 0 : params.orphanModules / params.fileCount;

  const todoPenalty = clamp(
    todoDensity * TECH_DEBT_SCORING.todoDensityMultiplier,
    0,
    TECH_DEBT_SCORING.todoPenaltyMax
  );
  const duplicationPenalty = clamp(
    params.duplicationPercentage * TECH_DEBT_SCORING.duplicationMultiplier,
    0,
    TECH_DEBT_SCORING.duplicationPenaltyMax
  );
  const cyclePenalty = clamp(
    params.dependencyCycles * TECH_DEBT_SCORING.cycleMultiplier,
    0,
    TECH_DEBT_SCORING.cyclePenaltyMax
  );
  const orphanPenalty = clamp(
    orphanRatio * TECH_DEBT_SCORING.orphanRatioMultiplier,
    0,
    TECH_DEBT_SCORING.orphanPenaltyMax
  );

  return clamp(
    Math.round(100 - todoPenalty - duplicationPenalty - cyclePenalty - orphanPenalty),
    0,
    100
  );
}

export function mergeRouteInventories(
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
