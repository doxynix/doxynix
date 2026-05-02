/**
 * Centralized scoring constants and formulas for the entire backend.
 * Single source of truth for all penalty multipliers, weights, and thresholds.
 *
 * This replaces scattered "magic numbers" across 7+ files with named constants
 * that can be tuned globally while maintaining consistency.
 */

import { logger } from "../../infrastructure/logger";

// ============================================================================
// COMPLEXITY SCORING
// ============================================================================

/**
 * Complexity score calculation parameters.
 * All penalties are subtracted from 100 (base score).
 */
export const COMPLEXITY_SCORING = {
  /** Average complexity multiplier - describes severity escalation */
  averageComplexityMultiplier: 1.6,
  /** Maximum penalty from average complexity (multiplied by 1.6) */
  averagePenaltyMax: 34,

  /** Dependency cycle multiplier - cycles severely impact score */
  cycleMultiplier: 8,
  /** Maximum penalty from dependency cycles (multiplied by 8) */
  cyclePenaltyMax: 24,

  /** Threshold above which nesting is considered "deep" */
  deepNestingThreshold: 8,

  /** Hotspot ratio multiplier - high-complexity files clustered = worse */
  hotspotRatioMultiplier: 30,
  /** Maximum penalty from hotspot ratio (multiplied by 30) */
  hotspotRatioPenaltyMax: 22,

  lineCountThreshold: 80, // LONG_FN_LINES
  /** Maximum penalty from max nesting depth (multiplied by 3) */
  maxNestingPenaltyMax: 20,

  /** Minimum complexity threshold (absolute floor) */
  minComplexityThreshold: 12,
  /** Nesting depth multiplier - deeper nesting = worse */
  nestingDepthMultiplier: 3,

  paramCountThreshold: 7, // MANY_PARAMS

  /** P85 percentile for complexity threshold detection */
  percentileThreshold: 0.85,
};

// ============================================================================
// TECH DEBT SCORING
// ============================================================================

/**
 * Technical debt score calculation parameters.
 * All penalties are subtracted from 100 (base score).
 */
export const TECH_DEBT_SCORING = {
  /** Cycle count multiplier (differs from complexity by 1 for tuning) */
  cycleMultiplier: 7,
  /** Maximum penalty from dependency cycles */
  cyclePenaltyMax: 22,

  /** Code duplication percentage multiplier */
  duplicationMultiplier: 1.8,
  /** Maximum penalty from code duplication */
  duplicationPenaltyMax: 28,

  highDuplicationThreshold: 15,

  minDuplicationThreshold: 8, // Процент, ниже которого не создаем Finding

  /** Maximum penalty from orphaned modules */
  orphanPenaltyMax: 18,
  /** Orphan module ratio multiplier (scaled 0-1) */
  orphanRatioMultiplier: 100 * 0.35, // = 35

  /** TODO count as pct of files multiplier */
  todoDensityMultiplier: 3,
  /** Maximum penalty from TODO item density */
  todoPenaltyMax: 18,
};

// ============================================================================
// RISK SCORING
// ============================================================================

/**
 * Risk model scoring parameters.
 * Each risk type calculated independently, then averaged.
 */
export const RISK_SCORING = {
  // Change Coupling Risk
  changeCouplingBase: 35,
  complexityWeightInHotspot: 0.15,
  cycleMultiplier: 14, // Higher than complexity (stricter penalty)

  // Dependency Cycle Risk
  dependencyCycleBase: 40,
  hotspotCountMultiplier: 3,

  // Hotspot Risk
  hotspotScoreMultiplier: 0.45,

  orphanCountMultiplier: 8,
  // Orphan Module Risk
  orphanModuleBase: 25,
  pairMultiplier: 3, // Additional scaling per pair

  strongestCommitMultiplier: 12, // Each strongly-coupled file pair
  // Graph Reliability Risk
  unresolvedImportMultiplier: 4,
};

// ============================================================================
// STRUCTURAL MODULARITY SCORING
// ============================================================================

/**
 * Module structure and organization quality score.
 * Penalties from cycles, hotspots, orphan modules.
 */
export const STRUCTURAL_MODULARITY_SCORING = {
  /** Cycle penalty per cycle (capped at max) */
  cycleMultiplier: 9,
  /** Maximum penalty from cycles */
  cyclePenaltyMax: 28,

  /** Hotspot penalty per high-inbound node (avgInbound * multiplier) */
  hotspotMultiplier: 3,
  /** Maximum penalty from hotspots (high-dependency nodes) */
  hotspotPenaltyMax: 35,

  /** Orphan penalty per module without dependencies */
  orphanMultiplier: 2,
  /** Maximum penalty from orphaned modules */
  orphanPenaltyMax: 22,
};

// ============================================================================
// FILE CLASSIFICATION SCORING (FileClassifier.getScore)
// ============================================================================

/**
 * Hard category scores for file importance in analysis.
 * Used by FileClassifier.getScore() - assigns base relevance score.
 * Range: 0-90 (allows room for context modifiers in context-manager.ts).
 */
export const FILE_CATEGORY_SCORING = {
  api: 90, // Route handlers, API endpoints (highest)

  assets: 5,
  benchmarks: 15,
  config: 85, // application configs, routes, settings
  // Default/heuristic
  defaultBase: 50, // Fallback for unclassified files
  depthBonus: 10, // Bonus for files less deep than expected

  docs: 10,
  generated: 5,

  infrastructure: 30, // Dockerfiles, CI/CD configs
  // Low signal
  lowSignalConfig: 15, // Lockfiles, migrations, gradle wrappers
  runtimeSource: 80, // Main application logic
  // Non-analyzable
  sensitive: 0, // Blocked from analysis (secrets, env files)

  // Moderate signal
  tests: 20, // Test files have some value but not primary
  // High signal
  tooling: 40, // Build configs, linters, formatters
};

// ============================================================================
// CONTEXT FILE SCORING MODIFIERS
// ============================================================================

/**
 * Modifiers applied to base FileClassifier score in context selection.
 * Used by context-manager.ts:scoreFile() to adjust priority for specific stages.
 */
export const FILE_CONTEXT_MODIFIERS = {
  apiFileBonus: 35, // For writer_api stage

  apiFileSecondaryBonus: 15, // For architect stage
  // Stage-specific bonuses
  configFileBonus: 10, // General

  configFileBonusForReadme: 25, // Context matters for README stage
  // Penalties for context
  docFilePenalty: -50, // Reduce doc files when not preferred
  // User preference flags
  preferredFileBonus: 80, // User explicitly selected
  primaryArchitectureBonus: 20, // Core domain files

  // Special file types
  rootManifestBonus: 30, // package.json, go.mod, Cargo.toml, etc.
  testFilePenalty: -60, // Reduce test files when not preferred
};

// ============================================================================
// MAPPER FILE SCORING (File selection for LLM prompts)
// ============================================================================

/**
 * Scoring used in mapper-skeleton.ts for selecting top N files to send to LLM.
 * Different from file-classification scoring (lines-based, not categorical).
 */
export const MAPPER_FILE_SCORING = {
  apiHeuristicBonus: 85,
  configFileBonus: 100,

  lineMultiplier: 0.02, // Each line = 0.02 points (400 lines = 8 points)
  // Top-N selection
  maxFilesInTree: 120, // Pick top 120 files by score
  // Line-based scoring
  maxLinesForLineScore: 400, // Lines above this are capped
  primaryArchitectureBonus: 70,
  // Category bonuses
  primaryEntrypointBonus: 120,

  secondaryArchitectureBonus: 35,
};

// ============================================================================
// DOCUMENTATION OUTPUT SCORING
// ============================================================================

/**
 * Documentation generation priority weights.
 * Used in doc-priority.ts to calculate which docs should be generated.
 */
export const DOC_PRIORITY_WEIGHTS = {
  api: 20,
  architecture: 20,
  changelog: 20,

  // Secondary documentation (lower priority)
  contributing: 20,
  // Primary documentation (higher priority)
  readme: 20,
};

// ============================================================================
// HEALTH SCORE CALCULATION (MODERN)
// ============================================================================

/**
 * Modern health score weighted aggregation.
 * Replaces legacy health score calculation.
 * Each component 0-100, then combined with weights.
 */
export const MODERN_HEALTH_SCORE = {
  activeActivityBonus: 4, // If updated < 90 days
  activityDaysThresholdActive: 90,
  activityDaysThresholdRecent: 30,
  busFactorWeight: 0.1,
  complexityWeight: 0.16,
  cyclesWeight: 0.1,
  // Documentation scoring specifics
  docDensityMultiplierForHealth: 4, // docDensity * 4

  documentationWeight: 0.08,
  // Duplication scoring specifics
  duplicationMultiplierForHealth: 2, // (100 - duplication*2)
  duplicationWeight: 0.12,
  // Recency bonuses (added AFTER calculation)
  recentActivityBonus: 10, // If updated < 30 days

  // Component weights (sum = 100%)
  securityWeight: 0.24,

  techDebtWeight: 0.2,
};

// ============================================================================
// GRAPH & RELATIONSHIP SCORING
// ============================================================================

/**
 * Edge weight and relationship scoring for dependency graphs.
 */
const GRAPH_SCORING = {
  /** Default edge weight when adding relationships */
  defaultEdgeWeight: 1,

  /** Maximum edges to include in preview (showing top N by weight) */
  graphPreviewEdgeLimit: 96,

  /** Module ranking formula: api_surface * X + route_count * Y + exports * Z + ... */
  moduleRankingWeights: {
    apiSurface: 6,
    exports: 2,
    routeCount: 5,
    symbolCount: 1,
  },
};

// ============================================================================
// PENALTY CONSISTENCY ALIASES
// ============================================================================

/**
 * DEPRECATED: These are for backward compatibility during migration.
 * Prefer the specific scoring object constants above.
 */
const PENALTY_CONSTANTS = {
  // Cycle penalties - NORMALIZED to use COMPLEXITY_SCORING.cycleMultiplier
  cyclePenaltyForComplexity: COMPLEXITY_SCORING.cycleMultiplier,
  cyclePenaltyForModularity: STRUCTURAL_MODULARITY_SCORING.cycleMultiplier,
  cyclePenaltyForRisk: RISK_SCORING.cycleMultiplier,
  cyclePenaltyForTechDebt: TECH_DEBT_SCORING.cycleMultiplier,
};

// ============================================================================
// LLM CALL STRATEGY (Temperature, Sampling)
// ============================================================================

/**
 * Different temperature strategies for different LLM task types.
 * Temperature controls randomness/creativity in outputs.
 */
export const LLM_TEMPERATURE_STRATEGY = {
  /** Classification/Detection tasks - must be deterministic (Sentinel, validation) */
  classification: {
    description: "Deterministic - deny reasoning, exact classification",
    temperature: 0.0,
    topK: 1,
    topP: 0.1,
  },

  /** Creative/Generative tasks - higher creativity (Writers: README, Architecture, etc.) */
  creative: {
    description: "Creative - diverse outputs with natural language variation",
    temperature: 0.4,
    topK: 16,
    topP: 0.5,
  },

  /** Default strategy (fallback) */
  default: {
    description: "Conservative - low randomness",
    temperature: 0.1,
    topK: 1,
    topP: 0.1,
  },

  /** Reasoning/Analysis tasks - moderate creativity (Mapper, Analysis) */
  reasoning: {
    description: "Balanced - structured analysis with some reasoning variance",
    temperature: 0.2,
    topK: 8,
    topP: 0.3,
  },
};

export const AI_POLICY_CONSTANTS = {
  /** Коэффициент оценки: сколько символов в среднем приходится на 1 токен */
  CHARS_PER_TOKEN_RATIO: 3.5,

  /** Максимальное кол-во токенов на один файл (чтобы один файл не съел весь бюджет) */
  FILE_TOKEN_LIMITS: {
    architect: 4000,
    writer_api: 6000,
    writer_architecture: 5000,
    writer_readme: 3500,
  },

  /** Пороги для анализа PR */
  PR_ANALYSIS: {
    COMPLEXITY_RATIO_THRESHOLD: 2.0,
    DENSE_CHANGE_THRESHOLD: 300, // Строк
    MAX_CHANGES_PER_FILE: 1000, // Строк изменений
    SEVERITY_THRESHOLDS: {
      CRITICAL: 9,
      HIGH: 7,
      MEDIUM: 4,
    },
  },

  /** Лимиты токенов на разные стадии анализа */
  TOKEN_BUDGETS: {
    architect: 210_000,
    pr_differential: 40_000, // Добавили для PR
    writer_api: 180_000,
    writer_architecture: 180_000,
    writer_readme: 150_000,
  },
} as const;

export type LLMTaskType = keyof typeof LLM_TEMPERATURE_STRATEGY;

// ============================================================================
// ADAPTER & PARSER PRIORITIES
// ============================================================================

export const ADAPTER_PRIORITIES = {
  regex: 100, // Базовый уровень (наименее точный)
  treeSitter: 200, // Средний уровень (AST без типов)
  typescript: 300, // Максимальный уровень (полный компилятор с типами)
};

// ============================================================================
// SCHEMA & COLLECTION LIMITS (Validation & UI)
// ============================================================================

export const SCHEMA_LIMITS = {
  maxCommitsInHotspots: 100,
  maxCyclesDetected: 100,
  maxDebugSignals: 100, // Для отображения в топ-сигналах
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

// ============================================================================
// HEURISTIC CONFIDENCE LEVELS (0-100)
// ============================================================================

/**
 * Уровни уверенности для различных методов извлечения фактов.
 * Чем глубже анализ, тем выше число.
 */
export const CONFIDENCE_LEVELS = {
  astRoute: 74,
  // Tree-sitter (Хорошая точность по структуре)
  astStructure: 80,
  astSymbol: 78,

  // Базовые категории
  configDiscovery: 90,
  frameworkDiscovery: 72,
  inferredLibrary: 68,

  lowSignalDiscovery: 58,

  // Regex / Manifests (Средняя точность)
  manifestMatch: 88,
  // OpenAPI / Swagger
  openapiSpec: 92,
  regexExported: 75,

  regexInternal: 60,
  // TypeScript Compiler (Самый надежный)
  tsCompiler: 95,
  tsHeuristic: 75,
  tsInferred: 88,
};

// ============================================================================
// ENTRYPOINT DETECTION CONFIDENCE
// ============================================================================

const ENTRYPOINT_CONFIDENCE = {
  heuristic: 58, // Предположение по названию файла
  libraryExport: 72, // Публичный экспорт библиотеки
  runtimeApi: 86, // Явный API endpoint
  runtimeLogic: 74, // Логика запуска
};

// ============================================================================
// ARCHITECTURE RANKING WEIGHTS
// ============================================================================

/**
 * Веса для определения "важности" модулей в архитектуре.
 * Используются для сортировки и выбора файлов в отчет.
 */
export const ARCHITECTURE_WEIGHTS = {
  apiSurfaceMultiplier: 4,
  complexityOffset: 1.15,
  exportMultiplier: 1,
  inboundMultiplier: 3, // Входящие связи важнее исходящих
  outboundMultiplier: 1,

  // Модификаторы для риск-модели
  riskInboundMultiplier: 14,
  riskOutboundMultiplier: 3,
};

// ============================================================================
// RISK SEVERITY THRESHOLDS
// ============================================================================

export const RISK_THRESHOLDS = {
  critical: 85,
  high: 65,
  moderate: 40,
};

// ============================================================================
// PIPELINE & DOCUMENTATION THRESHOLDS
// ============================================================================

export const DOC_PIPELINE_THRESHOLDS = {
  maxConfigPaths: 6,
  // Лимиты на количество путей в секциях
  maxEvidencePaths: 10,

  maxFirstLookPaths: 12,
  maxPublicInterfacePaths: 24,
  maxRiskPaths: 8,
  minConfidenceForFact: 70,
  // Порог уверенности, ниже которого ставится плашка "Unknown" или "Low Confidence"
  minConfidenceForStrength: 75,
};

/**
 * Validate that penalty values make sense (for development/testing).
 * All scores should clamp to 0-100.
 */
function validateScoringConstants(): string[] {
  const errors: string[] = [];

  // Check all penalties are positive
  if (COMPLEXITY_SCORING.averagePenaltyMax < 0) errors.push("averagePenaltyMax < 0");
  if (TECH_DEBT_SCORING.duplicationPenaltyMax < 0) errors.push("duplicationPenaltyMax < 0");

  // Check max penalties don't exceed 100
  if (COMPLEXITY_SCORING.averagePenaltyMax > 100) errors.push("averagePenaltyMax > 100");
  if (STRUCTURAL_MODULARITY_SCORING.cyclePenaltyMax > 100) errors.push("cyclePenaltyMax > 100");

  // Cycle multiplier consistency warning (not error, since context may differ)
  const cycleMultipliers = [
    COMPLEXITY_SCORING.cycleMultiplier,
    TECH_DEBT_SCORING.cycleMultiplier,
    STRUCTURAL_MODULARITY_SCORING.cycleMultiplier,
  ];
  const uniqueCycleMultipliers = new Set(cycleMultipliers);
  if (uniqueCycleMultipliers.size > 1) {
    logger.warn({
      cycleMultipliers,
      msg: "Cycle multipliers differ across modules; review if intentional",
    });
  }

  return errors;
}
