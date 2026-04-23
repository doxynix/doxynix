import { DocType } from "@prisma/client";

import type { AIResult } from "@/server/shared/engine/core/analysis-result.schemas";
import type { ReportSectionKind } from "@/server/shared/engine/core/documentation.types";
import { DOC_PRIORITY_WEIGHTS } from "@/server/shared/engine/core/scoring-constants";
import { hasText } from "@/server/shared/lib/string-utils";

export const ALL_DOC_TYPES = [
  DocType.README,
  DocType.API,
  DocType.ARCHITECTURE,
  DocType.CONTRIBUTING,
  DocType.CHANGELOG,
] as const satisfies readonly DocType[];

export const DOC_SECTION_DEPENDENCIES: Record<DocType, readonly ReportSectionKind[]> = {
  [DocType.API]: ["api_reference"],
  [DocType.ARCHITECTURE]: ["architecture", "risks", "onboarding"],
  [DocType.CHANGELOG]: [],
  [DocType.CODE_DOC]: [],
  [DocType.CONTRIBUTING]: ["overview", "onboarding"],
  [DocType.README]: ["overview", "architecture"],
};

export const DOC_WEIGHTS: Partial<Record<DocType, number>> = {
  [DocType.API]: DOC_PRIORITY_WEIGHTS.api,
  [DocType.ARCHITECTURE]: DOC_PRIORITY_WEIGHTS.architecture,
  [DocType.CHANGELOG]: DOC_PRIORITY_WEIGHTS.changelog,
  [DocType.CONTRIBUTING]: DOC_PRIORITY_WEIGHTS.contributing,
  [DocType.README]: DOC_PRIORITY_WEIGHTS.readme,
};

export function calculateDocumentationOutputScore(aiResult: Partial<AIResult>) {
  let score = 0;
  let generatedCount = 0;

  const snapshot = {
    api: hasText(aiResult.generatedApiMarkdown),
    architecture: hasText(aiResult.generatedArchitecture),
    changelog: hasText(aiResult.generatedChangelog),
    contributing: hasText(aiResult.generatedContributing),
    readme: hasText(aiResult.generatedReadme),
  };

  Object.entries(snapshot).forEach(([key, isGenerated]) => {
    if (isGenerated) {
      const type = DocType[key.toUpperCase() as keyof typeof DocType];
      score += DOC_WEIGHTS[type] ?? 0;
      generatedCount++;
    }
  });

  return {
    generatedCount,
    score,
    snapshot,
    totalCount: ALL_DOC_TYPES.length,
  };
}
