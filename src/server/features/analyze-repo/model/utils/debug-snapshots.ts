import { DocType } from "@prisma/client";

import {
  PRIMARY_DOC_TYPES,
  SECONDARY_DOC_TYPES,
} from "@/server/features/generate-docs/lib/doc-priority";
import type { RepoMetrics } from "@/server/shared/engine/core/metrics.types";

import type { buildStageContextPack } from "../context-manager";

type DocumentationInputSnapshot = NonNullable<RepoMetrics["documentationInput"]>;
type WriterPayload = {
  payload: string;
  sections: readonly string[];
  tier: "primary" | "secondary";
};

export function summarizeSectionForDebug(
  section: DocumentationInputSnapshot["sections"][keyof DocumentationInputSnapshot["sections"]]
) {
  return {
    confidence: section.confidence,
    evidencePaths: section.evidencePaths,
    unknowns: section.unknowns,
  };
}

export function buildSectionDebugSnapshot(documentationInput: DocumentationInputSnapshot) {
  return {
    api_reference: summarizeSectionForDebug(documentationInput.sections.api_reference),
    architecture: summarizeSectionForDebug(documentationInput.sections.architecture),
    onboarding: summarizeSectionForDebug(documentationInput.sections.onboarding),
    overview: summarizeSectionForDebug(documentationInput.sections.overview),
    risks: {
      ...summarizeSectionForDebug(documentationInput.sections.risks),
      derivedScores: documentationInput.sections.risks.body.derivedScores,
      findingIds: documentationInput.sections.risks.body.findings.map((finding) => finding.id),
      rawMetrics: documentationInput.sections.risks.body.rawMetrics,
    },
  };
}

export function buildWriterPlanDebugSnapshot(
  writerInputs: Record<
    "api" | "architecture" | "changelog" | "contributing" | "readme",
    WriterPayload
  >,
  requestedDocs: DocType[]
) {
  const requestedSet = new Set(requestedDocs);
  const summarizeDoc = (type: DocType, input: WriterPayload) => ({
    payloadSize: input.payload.length,
    requested: requestedSet.has(type),
    sections: [...input.sections],
    tier: input.tier,
  });

  return {
    primary: Object.fromEntries(
      PRIMARY_DOC_TYPES.map((type) => [
        type,
        summarizeDoc(
          type,
          type === DocType.README
            ? writerInputs.readme
            : type === DocType.API
              ? writerInputs.api
              : writerInputs.architecture
        ),
      ])
    ),
    secondary: Object.fromEntries(
      SECONDARY_DOC_TYPES.map((type) => [
        type,
        summarizeDoc(
          type,
          type === DocType.CONTRIBUTING ? writerInputs.contributing : writerInputs.changelog
        ),
      ])
    ),
  };
}

export function buildWriterContextSnapshot(
  writerContexts: Record<string, ReturnType<typeof buildStageContextPack>>
) {
  return Object.fromEntries(
    Object.entries(writerContexts).map(([key, value]) => [
      key,
      {
        budget: value.debug.budgetChars,
        droppedPaths: value.debug.dropped,
        overflowPrevented: value.debug.overflowPrevented,
        selectedByStage: value.debug.selected,
        selectedChars: value.debug.selectedChars,
        selectedEvidencePaths: value.debug.selectedEvidencePaths,
      },
    ])
  );
}
