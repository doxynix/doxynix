import type { DocType } from "@prisma/client";

import { ALL_DOC_TYPES } from "@/server/features/generate-docs/lib/doc-priority";
import type { RepoMetrics } from "@/server/shared/engine/core/metrics.types";

import type { buildStageContextPack } from "../context-manager";

type DocumentationInputSnapshot = NonNullable<RepoMetrics["documentationInput"]>;
type WriterPayload = {
  payload: string;
  sections: readonly string[];
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

  const docs = Object.fromEntries(
    ALL_DOC_TYPES.map((type) => {
      const key = type.toLowerCase() as keyof typeof writerInputs;
      const input = writerInputs[key];

      return [
        type,
        {
          payloadSize: input.payload.length,
          requested: requestedSet.has(type),
          sections: input.sections,
        },
      ];
    })
  );

  return { docs };
}

export function buildWriterContextSnapshot(
  writerContexts: Record<string, Awaited<ReturnType<typeof buildStageContextPack>>>
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
