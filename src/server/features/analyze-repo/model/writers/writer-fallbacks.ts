import type { Repo } from "@prisma/client";

import {
  buildFallbackApiDocument,
  buildFallbackArchitecture,
  buildFallbackContributing,
  buildFallbackReadme,
} from "@/server/features/generate-docs/lib/fallback-docs";
import { type AIResult } from "@/server/shared/engine/core/analysis-result.schemas";
import type { RepoMetrics } from "@/server/shared/engine/core/metrics.types";
import { hasText } from "@/server/shared/lib/string-utils";
import type { RepositoryFact, RepositoryFinding } from "@/server/shared/types";

import type { WriterName, WriterResult, WriterStatus } from "./writer-tasks";

type DocumentationInputSnapshot = NonNullable<RepoMetrics["documentationInput"]>;
type WriterTaskKey = "API" | "ARCHITECTURE" | "CHANGELOG" | "CONTRIBUTING" | "README";

export function buildWriterFallbackReason(name: WriterResult["name"], error?: string): string {
  return error != null && error.trim().length > 0
    ? `Writer failed and deterministic fallback was generated from canonical sections. Original error: ${error}`
    : "Writer returned no usable content; deterministic fallback was generated from canonical sections.";
}

export function buildFallbackAiResult(
  documentationInput: DocumentationInputSnapshot,
  hardMetrics: RepoMetrics,
  repositoryFacts: RepositoryFact[],
  repositoryFindings: RepositoryFinding[],
  error: unknown,
  stage: "architect" | "mapper" = "architect"
): AIResult {
  const riskTitles = documentationInput.sections.risks.body.findings.map(
    (finding) => finding.title
  );
  const riskSummaries = repositoryFindings.map((finding) => finding.summary);
  const fallbackReason = error instanceof Error ? error.message : String(error);
  const fallbackStageLabel = stage === "mapper" ? "mapper" : "architect";
  const fallbackRuntime =
    stage === "mapper"
      ? {
          mapper: {
            reason: fallbackReason,
            source: "fallback" as const,
            status: "partial" as const,
          },
        }
      : {
          architect: {
            reason: fallbackReason,
            source: "fallback" as const,
            status: "partial" as const,
          },
        };

  return {
    analysisRuntime: fallbackRuntime,
    executive_summary: {
      architecture_style:
        documentationInput.sections.architecture.body.modules.length > 0
          ? "Evidence-driven modular architecture"
          : "unknown",
      purpose: `Repository summary built from canonical analysis sections because the ${fallbackStageLabel} model returned partial output.`,
      stack_details: documentationInput.sections.overview.body.stackProfile,
    },
    findings: repositoryFindings.slice(0, 12),
    onboarding_guide: {
      prerequisites:
        documentationInput.sections.overview.body.stackProfile.length > 0
          ? documentationInput.sections.overview.body.stackProfile.slice(0, 5)
          : ["Unknown"],
      setup_steps: documentationInput.sections.onboarding.body.newcomerSteps,
    },
    refactoring_targets: [],
    repository_facts: repositoryFacts.slice(0, 16),
    sections: {
      api_structure: documentationInput.sections.api_reference.summary.join(" "),
      data_flow: documentationInput.sections.architecture.summary.join(" "),
      performance: riskTitles.length > 0 ? riskTitles.slice(0, 4) : ["Unknown"],
      security_audit: {
        risks: riskSummaries.length > 0 ? riskSummaries.slice(0, 4) : ["Unknown"],
        score: Math.max(1, Math.round(hardMetrics.securityScore / 10)),
      },
      tech_debt:
        riskSummaries.length > 0
          ? riskSummaries.slice(0, 6)
          : documentationInput.sections.risks.summary.length > 0
            ? documentationInput.sections.risks.summary
            : ["Unknown"],
    },
  };
}

export function applyWriterFallbacks(
  results: Array<WriterResult>,
  taskMap: Partial<Record<WriterTaskKey, number>>,
  repo: Repo,
  documentationInput: DocumentationInputSnapshot,
  writerErrors: Partial<Record<WriterName, string>>
): {
  generatedApiMarkdown?: string;
  generatedArchitecture?: string;
  generatedContributing?: string;
  generatedReadme?: string;
  updatedStatus: Record<WriterResult["name"], WriterStatus>;
  writerFallbacks: Record<string, string>;
} {
  const writerFallbacks: Record<string, string> = {};
  const updatedStatus: Record<WriterResult["name"], WriterStatus> = {
    api: "missing",
    architecture: "missing",
    changelog: "missing",
    contributing: "missing",
    readme: "missing",
  };
  let generatedReadme: string | undefined;
  let generatedApiMarkdown: string | undefined;
  let generatedContributing: string | undefined;
  let generatedArchitecture: string | undefined;

  if (taskMap.README != null) {
    const readmeResult = results[taskMap.README];
    if (readmeResult) {
      generatedReadme = readmeResult.content;
      updatedStatus.readme = readmeResult.status;
      if (!hasText(generatedReadme)) {
        generatedReadme = buildFallbackReadme(repo, documentationInput);
        updatedStatus.readme = hasText(generatedReadme) ? "fallback" : updatedStatus.readme;
        writerFallbacks.readme = buildWriterFallbackReason("readme", writerErrors.readme);
      }
    }
  }

  if (taskMap.API != null) {
    const apiResult = results[taskMap.API];
    if (apiResult != null) {
      updatedStatus.api = apiResult.status;
      if (apiResult.content != null) {
        const yamlMatch = RegExp(/```yaml([\s\S]*?)```/).exec(apiResult.content);
        if (yamlMatch) {
          generatedApiMarkdown = apiResult.content
            .replace(/# OpenAPI Specification[\s\S]*/, "")
            .trim();
        } else {
          generatedApiMarkdown = apiResult.content;
        }
      }
      if (!hasText(generatedApiMarkdown)) {
        generatedApiMarkdown = buildFallbackApiDocument(repo, documentationInput);
        updatedStatus.api = hasText(generatedApiMarkdown) ? "fallback" : updatedStatus.api;
        writerFallbacks.api = buildWriterFallbackReason("api", writerErrors.api);
      }
    }
  }

  if (taskMap.CONTRIBUTING != null) {
    const contributingResult = results[taskMap.CONTRIBUTING];
    if (contributingResult != null) {
      generatedContributing = contributingResult.content;
      updatedStatus.contributing = contributingResult.status;
      if (!hasText(generatedContributing)) {
        generatedContributing = buildFallbackContributing(documentationInput);
        updatedStatus.contributing = hasText(generatedContributing)
          ? "fallback"
          : updatedStatus.contributing;
        writerFallbacks.contributing = buildWriterFallbackReason(
          "contributing",
          writerErrors.contributing
        );
      }
    }
  }

  if (taskMap.ARCHITECTURE != null) {
    const architectureResult = results[taskMap.ARCHITECTURE];
    if (architectureResult != null) {
      generatedArchitecture = architectureResult.content;
      updatedStatus.architecture = architectureResult.status;
      if (!hasText(generatedArchitecture)) {
        generatedArchitecture = buildFallbackArchitecture(repo, documentationInput);
        updatedStatus.architecture = hasText(generatedArchitecture)
          ? "fallback"
          : updatedStatus.architecture;
        writerFallbacks.architecture = buildWriterFallbackReason(
          "architecture",
          writerErrors.architecture
        );
      }
    }
  }

  return {
    generatedApiMarkdown,
    generatedArchitecture,
    generatedContributing,
    generatedReadme,
    updatedStatus,
    writerFallbacks,
  };
}
