import { DocType } from "@prisma/client";

import type { RepoMetrics } from "../engine/core/metrics.types";
import { DOC_SECTION_DEPENDENCIES } from "./doc-priority";

type DocumentationInputSnapshot = NonNullable<RepoMetrics["documentationInput"]>;
type WriterPayload = {
  payload: string;
  sections: readonly string[];
};

export function serializeAllowedPaths(paths: string[]): string {
  return JSON.stringify(paths.slice().sort((left, right) => left.localeCompare(right)));
}

export function buildWriterSectionPayloads(
  documentationInput: DocumentationInputSnapshot
): Record<"api" | "architecture" | "changelog" | "contributing" | "readme", WriterPayload> {
  return {
    api: {
      payload: JSON.stringify(documentationInput.sections.api_reference, null, 2),
      sections: DOC_SECTION_DEPENDENCIES[DocType.API],
    } satisfies WriterPayload,
    architecture: {
      payload: JSON.stringify(documentationInput.sections.architecture, null, 2),
      sections: DOC_SECTION_DEPENDENCIES[DocType.ARCHITECTURE],
    } satisfies WriterPayload,
    changelog: {
      payload: "",
      sections: DOC_SECTION_DEPENDENCIES[DocType.CHANGELOG],
    } satisfies WriterPayload,
    contributing: {
      payload: JSON.stringify(
        {
          onboarding: documentationInput.sections.onboarding,
          overview: documentationInput.sections.overview,
        },
        null,
        2
      ),
      sections: DOC_SECTION_DEPENDENCIES[DocType.CONTRIBUTING],
    } satisfies WriterPayload,
    readme: {
      payload: JSON.stringify(
        {
          architecture: documentationInput.sections.architecture,
          overview: documentationInput.sections.overview,
        },
        null,
        2
      ),
      sections: DOC_SECTION_DEPENDENCIES[DocType.README],
    } satisfies WriterPayload,
  };
}
