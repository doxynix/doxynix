import { DocType } from "@prisma/client";

import { DOC_SECTION_DEPENDENCIES } from "@/server/features/generate-docs/lib/doc-priority";
import type { RepoMetrics } from "@/server/shared/engine/core/metrics.types";

type DocumentationInputSnapshot = NonNullable<RepoMetrics["documentationInput"]>;
type WriterPayload = {
  payload: string;
  sections: readonly string[];
};

export function serializeForWriter(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function serializeAllowedPaths(paths: string[]): string {
  return JSON.stringify(paths.slice().sort((left, right) => left.localeCompare(right)));
}

export function buildWriterSectionPayloads(
  documentationInput: DocumentationInputSnapshot
): Record<"api" | "architecture" | "changelog" | "contributing" | "readme", WriterPayload> {
  return {
    api: {
      payload: serializeForWriter(documentationInput.sections.api_reference),
      sections: DOC_SECTION_DEPENDENCIES[DocType.API],
    } satisfies WriterPayload,
    architecture: {
      payload: serializeForWriter(documentationInput.sections.architecture),
      sections: DOC_SECTION_DEPENDENCIES[DocType.ARCHITECTURE],
    } satisfies WriterPayload,
    changelog: {
      payload: "",
      sections: DOC_SECTION_DEPENDENCIES[DocType.CHANGELOG],
    } satisfies WriterPayload,
    contributing: {
      payload: serializeForWriter({
        onboarding: documentationInput.sections.onboarding,
        overview: documentationInput.sections.overview,
      }),
      sections: DOC_SECTION_DEPENDENCIES[DocType.CONTRIBUTING],
    } satisfies WriterPayload,
    readme: {
      payload: serializeForWriter({
        architecture: documentationInput.sections.architecture,
        overview: documentationInput.sections.overview,
      }),
      sections: DOC_SECTION_DEPENDENCIES[DocType.README],
    } satisfies WriterPayload,
  };
}
