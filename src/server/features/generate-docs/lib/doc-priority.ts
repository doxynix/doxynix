import { DocType } from "@prisma/client";

import type { AIResult } from "@/server/features/analyze-repo/lib/schemas";
import type { ReportSectionKind } from "@/server/shared/engine/core/types";

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

function hasGeneratedContent(content: string | undefined) {
  return typeof content === "string" && content.trim().length > 0;
}

export function buildGeneratedDocPrioritySnapshot(aiResult: GeneratedDocState) {
  return {
    primary: {
      api: hasGeneratedContent(aiResult.generatedApiMarkdown),
      architecture: hasGeneratedContent(aiResult.generatedArchitecture),
      readme: hasGeneratedContent(aiResult.generatedReadme),
    },
    secondary: {
      changelog: hasGeneratedContent(aiResult.generatedChangelog),
      contributing: hasGeneratedContent(aiResult.generatedContributing),
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
