import { clamp, mean } from "es-toolkit";

import { percentile } from "@/server/utils/math-utils";

import type { RepoMetrics } from "../core/metrics.types";
import { COMPLEXITY_SCORING, TECH_DEBT_SCORING } from "../core/scoring-constants";

export function normalizeComplexityScore(params: {
  cycles: number;
  fileCount: number;
  maxNesting: number;
  scores: number[];
}): number {
  if (params.scores.length === 0 || params.fileCount === 0) {
    return 100;
  }

  const average = params.scores.length === 0 ? 0 : mean(params.scores);

  const p85 = percentile(params.scores, COMPLEXITY_SCORING.percentileThreshold);
  const highComplexityThreshold = Math.max(COMPLEXITY_SCORING.minComplexityThreshold, p85);
  const highComplexityFiles = params.scores.filter(
    (score) => score >= highComplexityThreshold
  ).length;

  const hotspotRatio = highComplexityFiles / params.fileCount;

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
}): number {
  if (params.fileCount === 0) {
    return 100;
  }

  const todoDensity = params.todos / params.fileCount;
  const orphanRatio = params.orphanModules / params.fileCount;

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

  const combinedFrameworks = Array.from(new Set([...extractedInventory.frameworks, "OpenAPI"]));

  let finalSource: "extracted" | "mixed" | "openapi" = "openapi";
  if (extractedInventory.estimatedOperations > 0 && openapiInventory.estimatedOperations > 0) {
    finalSource = "mixed";
  } else if (extractedInventory.estimatedOperations > 0) {
    finalSource = "extracted";
  }

  return {
    estimatedOperations: Math.max(
      extractedInventory.estimatedOperations,
      openapiInventory.estimatedOperations
    ),
    frameworks: combinedFrameworks,
    httpRoutes: extractedInventory.httpRoutes,
    rpcProcedures: extractedInventory.rpcProcedures,
    source: finalSource,
    sourceFiles: Array.from(
      new Set([...extractedInventory.sourceFiles, ...openapiInventory.sourceFiles])
    ).sort((a, b) => a.localeCompare(b)),
  };
}
