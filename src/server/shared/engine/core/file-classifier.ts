import { normalizeLanguageName } from "@/shared/lib/utils";

import { ProjectPolicy } from "./project-policy";
import { FILE_CATEGORY_SCORING } from "./scoring-constants";

export function getFileScore(path: string): number {
  const lower = path.toLowerCase();

  if (ProjectPolicy.isSensitive(lower)) return FILE_CATEGORY_SCORING.sensitive;
  if (ProjectPolicy.isLowSignalConfig(lower)) return FILE_CATEGORY_SCORING.lowSignalConfig;
  if (ProjectPolicy.isGeneratedFile(lower) || ProjectPolicy.isAssetFile(lower))
    return FILE_CATEGORY_SCORING.generated;
  if (ProjectPolicy.isDocsFile(lower)) return FILE_CATEGORY_SCORING.docs;
  if (ProjectPolicy.isBenchmarkFile(lower)) return FILE_CATEGORY_SCORING.benchmarks;
  if (ProjectPolicy.isTestFile(lower)) return FILE_CATEGORY_SCORING.tests;
  if (ProjectPolicy.isInfraFile(lower)) return FILE_CATEGORY_SCORING.infrastructure;
  if (ProjectPolicy.isToolingFile(lower)) return FILE_CATEGORY_SCORING.tooling;
  if (ProjectPolicy.isConfigFile(lower)) return FILE_CATEGORY_SCORING.config;
  if (ProjectPolicy.isApiPath(lower)) return FILE_CATEGORY_SCORING.api;
  if (ProjectPolicy.isRuntimeSource(lower)) return FILE_CATEGORY_SCORING.runtimeSource;

  if (lower.includes("/ui/") || lower.includes("/components/"))
    return FILE_CATEGORY_SCORING.tooling; // UI files similar priority to tooling

  const depth = path.split("/").length;
  let score = FILE_CATEGORY_SCORING.defaultBase;
  if (depth < 3) score += FILE_CATEGORY_SCORING.depthBonus;

  return score;
}

export function linguistStyleLabel(filePath: string, fallbackName: string): string {
  const extMatch = /(\.[^./\\]+)$/u.exec(filePath);
  const ext = extMatch?.[1] ?? "";
  return normalizeLanguageName(ext) || fallbackName;
}
