import { DocType } from "@prisma/client";

import type { AIResult } from "@/server/shared/engine/core/analysis-result.schemas";
import type { ReportSectionKind } from "@/server/shared/engine/core/documentation.types";
import { hasText } from "@/server/shared/lib/string-utils";

type GeneratedDocState = Pick<
  AIResult,
  | "generatedApiMarkdown"
  | "generatedArchitecture"
  | "generatedChangelog"
  | "generatedContributing"
  | "generatedReadme"
>;

export const PRIMARY_DOC_TYPES = [
  DocType.README,
  DocType.API,
  DocType.ARCHITECTURE,
] as const satisfies readonly DocType[];

export const SECONDARY_DOC_TYPES = [
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

const PRIMARY_DOC_WEIGHTS: Record<(typeof PRIMARY_DOC_TYPES)[number], number> = {
  [DocType.API]: 16,
  [DocType.ARCHITECTURE]: 18,
  [DocType.README]: 18,
};

const SECONDARY_DOC_WEIGHTS: Record<(typeof SECONDARY_DOC_TYPES)[number], number> = {
  [DocType.CHANGELOG]: 3,
  [DocType.CONTRIBUTING]: 5,
};

export function buildGeneratedDocPrioritySnapshot(aiResult: GeneratedDocState) {
  return {
    primary: {
      api: hasText(aiResult.generatedApiMarkdown),
      architecture: hasText(aiResult.generatedArchitecture),
      readme: hasText(aiResult.generatedReadme),
    },
    secondary: {
      changelog: hasText(aiResult.generatedChangelog),
      contributing: hasText(aiResult.generatedContributing),
    },
  };
}

export function calculateDocumentationOutputScore(aiResult: GeneratedDocState) {
  const snapshot = buildGeneratedDocPrioritySnapshot(aiResult);
  let score = 0;

  if (snapshot.primary.readme) score += PRIMARY_DOC_WEIGHTS[DocType.README];
  if (snapshot.primary.api) score += PRIMARY_DOC_WEIGHTS[DocType.API];
  if (snapshot.primary.architecture) score += PRIMARY_DOC_WEIGHTS[DocType.ARCHITECTURE];
  if (snapshot.secondary.contributing) score += SECONDARY_DOC_WEIGHTS[DocType.CONTRIBUTING];
  if (snapshot.secondary.changelog) score += SECONDARY_DOC_WEIGHTS[DocType.CHANGELOG];

  return {
    primaryDocCount:
      Number(snapshot.primary.readme) +
      Number(snapshot.primary.api) +
      Number(snapshot.primary.architecture),
    score,
    secondaryDocCount:
      Number(snapshot.secondary.contributing) + Number(snapshot.secondary.changelog),
    snapshot,
  };
}
