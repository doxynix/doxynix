import { appLogger } from "@/server/core/app-logger";

// All penalties are subtracted from a 100 base score.
export const COMPLEXITY_SCORING = {
  averageComplexityMultiplier: 1.6,
  averagePenaltyMax: 34,

  cycleMultiplier: 8,
  cyclePenaltyMax: 24,

  deepNestingThreshold: 8,

  hotspotRatioMultiplier: 30,
  hotspotRatioPenaltyMax: 22,

  lineCountThreshold: 80, // LONG_FN_LINES
  maxNestingPenaltyMax: 20,

  minComplexityThreshold: 12,
  nestingDepthMultiplier: 3,

  paramCountThreshold: 7, // MANY_PARAMS

  percentileThreshold: 0.85,
} as const;

export const TECH_DEBT_SCORING = {
  cycleMultiplier: 7, // differs from complexity (8) by 1 for tuning
  cyclePenaltyMax: 22,

  duplicationMultiplier: 1.8,
  duplicationPenaltyMax: 28,

  highDuplicationThreshold: 15,

  minDuplicationThreshold: 8, // Percentage below which we don't create a Finding

  orphanPenaltyMax: 18,
  orphanRatioMultiplier: 100 * 0.35,

  /** TODO count as pct of files multiplier */
  todoDensityMultiplier: 3,
  /** Maximum penalty from TODO item density */
  todoPenaltyMax: 18,
} as const;

// Each risk type is calculated independently, then averaged.
export const RISK_SCORING = {
  changeCouplingBase: 35,
  complexityWeightInHotspot: 0.15,
  cycleMultiplier: 14, // Higher than complexity (stricter penalty)

  dependencyCycleBase: 40,
  hotspotCountMultiplier: 3,

  hotspotScoreMultiplier: 0.45,

  orphanCountMultiplier: 8,
  orphanModuleBase: 25,
  pairMultiplier: 3,

  strongestCommitMultiplier: 12,
  unresolvedImportMultiplier: 4,
} as const;

export const STRUCTURAL_MODULARITY_SCORING = {
  cycleMultiplier: 9,
  cyclePenaltyMax: 28,

  hotspotMultiplier: 3,
  hotspotPenaltyMax: 35,

  orphanMultiplier: 2,
  orphanPenaltyMax: 22,
} as const;

// Base relevance per category; capped at 90 to leave room for the context modifiers above.

// Applied to the base FileClassifier score by context-manager.ts:scoreFile() to tune per-stage priority.
export const FILE_CONTEXT_MODIFIERS = {
  apiFileBonus: 35, // For writer_api stage

  apiFileSecondaryBonus: 15, // For architect stage
  configFileBonus: 10,

  configFileBonusForReadme: 25,
  docFilePenalty: -50,
  preferredFileBonus: 80, // user explicitly selected the file
  primaryArchitectureBonus: 20, // core domain files

  rootManifestBonus: 30, // package.json, go.mod, Cargo.toml, etc.
  testFilePenalty: -60, // applied when tests are not preferred
} as const;

// Line-based (not categorical) top-N selection for mapper-skeleton.ts — distinct from
// FILE_CATEGORY_SCORING.
export const MAPPER_FILE_SCORING = {
  apiHeuristicBonus: 85,
  configFileBonus: 100,

  lineMultiplier: 0.02, // per line; 400 lines = 8 points
  maxFilesInTree: 75,
  maxLinesForLineScore: 400,
  primaryArchitectureBonus: 70,
  primaryEntrypointBonus: 120,

  secondaryArchitectureBonus: 35,
} as const;

// Consumed by doc-priority.ts to rank which docs to generate.
export const DOC_PRIORITY_WEIGHTS = {
  api: 25,
  architecture: 20,
  changelog: 15,
  contributing: 10,
  readme: 30,
} as const;

// Each component is 0-100, then combined with the weights below.
export const MODERN_HEALTH_SCORE = {
  activeActivityBonus: 4, // If updated < 90 days
  activityDaysThresholdActive: 90,
  activityDaysThresholdRecent: 30,
  busFactorWeight: 0.1,
  complexityWeight: 0.16,
  cyclesWeight: 0.1,
  docDensityMultiplierForHealth: 4,

  documentationWeight: 0.08,
  duplicationMultiplierForHealth: 2,
  duplicationWeight: 0.12,
  // Recency bonuses are added after the weighted sum.
  recentActivityBonus: 10, // If updated < 30 days

  // Component weights (sum = 100%)
  securityWeight: 0.24,

  techDebtWeight: 0.2,
};

export const GRAPH_SCORING = {
  defaultEdgeWeight: 1,

  // Preview shows only the top N edges by weight.
  graphPreviewEdgeLimit: 96,

  // Module rank = weighted sum of apiSurface, routeCount, exports, symbolCount.
  moduleRankingWeights: {
    apiSurface: 6,
    exports: 2,
    routeCount: 5,
    symbolCount: 1,
  },
};

// Deprecated: back-compat aliases of the per-scoring constants above.
export const PENALTY_CONSTANTS = {
  cyclePenaltyForComplexity: COMPLEXITY_SCORING.cycleMultiplier,
  cyclePenaltyForModularity: STRUCTURAL_MODULARITY_SCORING.cycleMultiplier,
  cyclePenaltyForRisk: RISK_SCORING.cycleMultiplier,
  cyclePenaltyForTechDebt: TECH_DEBT_SCORING.cycleMultiplier,
};

export const ADAPTER_PRIORITIES = {
  regex: 100, // Base level (least accurate)
  treeSitter: 200, // Mid level (AST without types)
  typescript: 300, // Maximum level (full compiler with types)
};

export const SCHEMA_LIMITS = {
  maxCommitsInHotspots: 100,
  maxCyclesDetected: 100,
  maxDebugSignals: 100,
  maxDominantLanguages: 100,
  maxEvidencePerFact: 100,
  maxEvidencePerFinding: 100,
  maxFilesPerScanBatch: 100,
  maxFilesToSkeletonize: 100,
  maxFrameworksInProfile: 100,
  maxRepositoryFacts: 100,
  maxRepositoryFindings: 100,
  maxUnresolvedImportsSamples: 100,
};

// Deeper analysis methods score higher.
export const CONFIDENCE_LEVELS = {
  astRoute: 74,
  // Tree-sitter (good structural accuracy)
  astStructure: 80,
  astSymbol: 78,

  configDiscovery: 90,
  frameworkDiscovery: 72,
  inferredLibrary: 68,

  lowSignalDiscovery: 58,

  // Regex / Manifests (medium accuracy)
  manifestMatch: 88,
  openapiSpec: 92,
  regexExported: 75,

  regexInternal: 60,
  // TypeScript compiler (most reliable)
  tsCompiler: 95,
  tsHeuristic: 75,
  tsInferred: 88,
};

export const ENTRYPOINT_CONFIDENCE = {
  heuristic: 58, // Guess based on file name
  libraryExport: 72,
  runtimeApi: 86, // Explicit API endpoint
  runtimeLogic: 74,
};

export const ARCHITECTURE_WEIGHTS = {
  apiSurfaceMultiplier: 4,
  complexityOffset: 1.15,
  exportMultiplier: 1,
  inboundMultiplier: 3, // Inbound connections matter more than outbound ones
  outboundMultiplier: 1,

  riskInboundMultiplier: 14,
  riskOutboundMultiplier: 3,
};

export const RISK_THRESHOLDS = {
  critical: 85,
  high: 65,
  moderate: 40,
} as const;

export const DOC_PIPELINE_THRESHOLDS = {
  maxConfigPaths: 6,

  maxEvidencePaths: SCHEMA_LIMITS.maxEvidencePerFinding,

  maxFirstLookPaths: 12,
  maxPublicInterfacePaths: 24,
  maxRiskPaths: 8,
  minConfidenceForFact: 70,
  // Confidence threshold below which the "Unknown" or "Low Confidence" badge is shown
  minConfidenceForStrength: 75,
} as const;

export function validateScoringConstants(): string[] {
  const errors: string[] = [];

  const metricsToValidate = [
    { name: "COMPLEXITY_SCORING.averagePenaltyMax", value: COMPLEXITY_SCORING.averagePenaltyMax },
    {
      name: "TECH_DEBT_SCORING.duplicationPenaltyMax",
      value: TECH_DEBT_SCORING.duplicationPenaltyMax,
    },
    {
      name: "STRUCTURAL_MODULARITY_SCORING.cyclePenaltyMax",
      value: STRUCTURAL_MODULARITY_SCORING.cyclePenaltyMax,
    },
  ];

  for (const metric of metricsToValidate) {
    if (metric.value < 0) {
      errors.push(`${metric.name} < 0`);
    }
    if (metric.value > 100) {
      errors.push(`${metric.name} > 100`);
    }
  }

  const cycleMultipliers = [
    COMPLEXITY_SCORING.cycleMultiplier,
    TECH_DEBT_SCORING.cycleMultiplier,
    STRUCTURAL_MODULARITY_SCORING.cycleMultiplier,
  ];

  const uniqueCycleMultipliers = new Set(cycleMultipliers);
  if (uniqueCycleMultipliers.size > 1) {
    appLogger.warn({
      cycleMultipliers,
      msg: "Cycle multipliers differ across modules; review if intentional",
    });
  }

  return errors;
}
