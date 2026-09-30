import {
  isApiPath,
  isAssetFile,
  isBenchmarkFile,
  isConfigFile,
  isDocsFile,
  isFrontendComponent,
  isGeneratedFile,
  isInfraFile,
  isLowSignalConfig,
  isRuntimeSource,
  isSensitive,
  isTestFile,
  isToolingFile,
} from "./index";

/** Relative importance of a file, used to rank what is worth reading first. */
export const FILE_CATEGORY_SCORING = {
  api: 90, // route handlers, API endpoints

  assets: 5,
  benchmarks: 15,
  config: 85,
  defaultBase: 50,
  depthBonus: 10,

  docs: 10,
  generated: 5,

  infrastructure: 30, // Dockerfiles, CI/CD configs
  lowSignalConfig: 15, // Lockfiles, migrations, gradle wrappers
  runtimeSource: 80, // main application logic
  sensitive: 0, // excluded from analysis: secrets, env files

  tests: 20, // useful but not primary
  tooling: 40, // Build configs, linters, formatters
} as const;

export function getFileScore(path: string): number {
  const value = path.toLowerCase();

  if (isSensitive(value)) {
    return FILE_CATEGORY_SCORING.sensitive;
  }
  if (isLowSignalConfig(value)) {
    return FILE_CATEGORY_SCORING.lowSignalConfig;
  }
  if (isGeneratedFile(value) || isAssetFile(value)) {
    return FILE_CATEGORY_SCORING.generated;
  }
  if (isDocsFile(value)) {
    return FILE_CATEGORY_SCORING.docs;
  }
  if (isBenchmarkFile(value)) {
    return FILE_CATEGORY_SCORING.benchmarks;
  }
  if (isTestFile(value)) {
    return FILE_CATEGORY_SCORING.tests;
  }
  if (isInfraFile(value)) {
    return FILE_CATEGORY_SCORING.infrastructure;
  }
  if (isToolingFile(value)) {
    return FILE_CATEGORY_SCORING.tooling;
  }
  if (isConfigFile(value)) {
    return FILE_CATEGORY_SCORING.config;
  }
  if (isApiPath(value)) {
    return FILE_CATEGORY_SCORING.api;
  }
  if (isRuntimeSource(value)) {
    return FILE_CATEGORY_SCORING.runtimeSource;
  }
  if (isFrontendComponent(value)) {
    return FILE_CATEGORY_SCORING.runtimeSource;
  }

  const depth = path.split("/").length;
  let score = FILE_CATEGORY_SCORING.defaultBase;
  if (depth < 3) {
    score += FILE_CATEGORY_SCORING.depthBonus;
  }

  return score;
}
