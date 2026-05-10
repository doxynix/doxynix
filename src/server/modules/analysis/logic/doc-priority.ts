import type { DocType } from "@prisma/client";

import type { hasText } from "@/server/utils/string-utils";

import type { ReportSectionKind } from "../engine/core/documentation.types";
import type { DOC_PRIORITY_WEIGHTS } from "../engine/core/scoring-constants";

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

const DOC_WEIGHTS: Record<DocType, number> = {
  [DocType.API]: DOC_PRIORITY_WEIGHTS.api,
  [DocType.ARCHITECTURE]: DOC_PRIORITY_WEIGHTS.architecture,
  [DocType.CHANGELOG]: DOC_PRIORITY_WEIGHTS.changelog,
  [DocType.CODE_DOC]: 0,
  [DocType.CONTRIBUTING]: DOC_PRIORITY_WEIGHTS.contributing,
  [DocType.README]: DOC_PRIORITY_WEIGHTS.readme,
};

const SNAPSHOT_KEY_TO_DOC_TYPE: Record<string, DocType> = {
  api: DocType.API,
  architecture: DocType.ARCHITECTURE,
  changelog: DocType.CHANGELOG,
  contributing: DocType.CONTRIBUTING,
  readme: DocType.README,
};

type GeneratedDocsInput = {
  generatedApiMarkdown?: string;
  generatedArchitecture?: string;
  generatedChangelog?: string;
  generatedContributing?: string;
  generatedReadme?: string;
  swaggerYaml?: string;
};

/**
 * Расчет скоринга полноты документации.
 */
export function calculateDocumentationOutputScore(docs: GeneratedDocsInput) {
  let score = 0;
  let generatedCount = 0;

  const snapshot = {
    api: hasText(docs.generatedApiMarkdown),
    architecture: hasText(docs.generatedArchitecture),
    changelog: hasText(docs.generatedChangelog),
    contributing: hasText(docs.generatedContributing),
    readme: hasText(docs.generatedReadme),
  };

  Object.entries(snapshot).forEach(([key, isGenerated]) => {
    if (isGenerated) {
      const type = SNAPSHOT_KEY_TO_DOC_TYPE[key];
      if (type != null) {
        score += DOC_WEIGHTS[type];
        generatedCount++;
      }
    }
  });

  return {
    generatedCount,
    score,
    snapshot,
    totalCount: ALL_DOC_TYPES.length,
  };
}
