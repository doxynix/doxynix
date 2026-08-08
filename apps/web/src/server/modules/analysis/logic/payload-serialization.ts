import { DocType } from "@prisma/client";

import type { RepoMetrics } from "../engine/core/metrics.types";
import { DOC_SECTION_DEPENDENCIES } from "./doc-priority";

type DocumentationInputSnapshot = NonNullable<RepoMetrics["documentationInput"]>;
type WriterPayload = {
  payload: string;
  sections: readonly string[];
};

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isGraphReliabilityLike(value: Record<string, unknown>) {
  return (
    typeof value.resolvedEdges === "number" && typeof value.unresolvedImportSpecifiers === "number"
  );
}

function compactPromptPayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    const compacted = value
      .map((item) => compactPromptPayload(item))
      .filter((item) => item != null && (!Array.isArray(item) || item.length > 0));
    return compacted.length > 0 ? compacted : undefined;
  }

  if (!isObject(value)) return value;

  const graphReliability = isGraphReliabilityLike(value);
  const cleaned: Record<string, unknown> = {};

  for (const [key, raw] of Object.entries(value)) {
    if (graphReliability && key === "edges") continue;

    const next =
      graphReliability && key === "unresolvedSamples" && Array.isArray(raw)
        ? compactPromptPayload(raw.slice(0, 8))
        : compactPromptPayload(raw);

    if (
      next != null &&
      (!Array.isArray(next) || next.length > 0) &&
      (!isObject(next) || Object.keys(next).length > 0)
    ) {
      cleaned[key] = next;
    }
  }

  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

export function toPromptJson(value: unknown): string {
  return JSON.stringify(compactPromptPayload(value) ?? {});
}

function buildReadmePayload(documentationInput: DocumentationInputSnapshot) {
  const { architecture, onboarding, overview } = documentationInput.sections;

  return {
    architecture: {
      body: {
        graphReliability: architecture.body.graphReliability,
        modules: architecture.body.modules.slice(0, 8),
        primaryEntrypoints: architecture.body.primaryEntrypoints,
      },
      confidence: architecture.confidence,
      evidencePaths: architecture.evidencePaths.slice(0, 12),
      summary: architecture.summary,
      title: architecture.title,
      unknowns: architecture.unknowns,
    },
    onboarding: {
      body: {
        apiPaths: onboarding.body.apiPaths,
        configPaths: onboarding.body.configPaths,
        firstLookPaths: onboarding.body.firstLookPaths,
        newcomerSteps: onboarding.body.newcomerSteps,
      },
      confidence: onboarding.confidence,
      evidencePaths: onboarding.evidencePaths.slice(0, 16),
      summary: onboarding.summary,
      title: onboarding.title,
      unknowns: onboarding.unknowns,
    },
    overview,
  };
}

export function serializeAllowedPaths(paths: string[]): string {
  return JSON.stringify(paths.slice().sort((left, right) => left.localeCompare(right)));
}

export function buildWriterSectionPayloads(
  documentationInput: DocumentationInputSnapshot
): Record<"api" | "architecture" | "changelog" | "contributing" | "readme", WriterPayload> {
  return {
    api: {
      payload: toPromptJson(documentationInput.sections.api_reference),
      sections: DOC_SECTION_DEPENDENCIES[DocType.API],
    } satisfies WriterPayload,
    architecture: {
      payload: toPromptJson(documentationInput.sections.architecture),
      sections: DOC_SECTION_DEPENDENCIES[DocType.ARCHITECTURE],
    } satisfies WriterPayload,
    changelog: {
      payload: "",
      sections: DOC_SECTION_DEPENDENCIES[DocType.CHANGELOG],
    } satisfies WriterPayload,
    contributing: {
      payload: toPromptJson({
        onboarding: documentationInput.sections.onboarding,
        overview: documentationInput.sections.overview,
      }),
      sections: DOC_SECTION_DEPENDENCIES[DocType.CONTRIBUTING],
    } satisfies WriterPayload,
    readme: {
      payload: toPromptJson(buildReadmePayload(documentationInput)),
      sections: DOC_SECTION_DEPENDENCIES[DocType.README],
    } satisfies WriterPayload,
  };
}
