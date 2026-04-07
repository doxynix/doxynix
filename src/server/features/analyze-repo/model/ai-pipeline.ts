import { DocType, type Repo, type Status } from "@prisma/client";

import { AI_MODELS, SAFETY_SETTINGS } from "@/server/features/analyze-repo/lib/constants";
import {
  ANALYSIS_SYSTEM_PROMPT,
  ANALYSIS_USER_PROMPT,
  API_WRITER_SYSTEM_PROMPT,
  API_WRITER_USER_PROMPT,
  ARCHITECTURE_WRITER_SYSTEM_PROMPT,
  ARCHITECTURE_WRITER_USER_PROMPT,
  CHANGELOG_WRITER_SYSTEM_PROMPT,
  CHANGELOG_WRITER_USER_PROMPT,
  CONTRIBUTING_WRITER_SYSTEM_PROMPT,
  CONTRIBUTING_WRITER_USER_PROMPT,
  MAPPER_SYSTEM_PROMPT,
  MAPPER_USER_PROMPT,
  README_WRITER_SYSTEM_PROMPT,
  README_WRITER_USER_PROMPT,
  SENTINEL_SYSTEM_PROMPT,
  SENTINEL_USER_PROMPT,
} from "@/server/features/analyze-repo/lib/prompts";
import {
  aiSchema,
  projectMapSchema,
  sentinelSchema,
  type AIResult,
  type ProjectMap,
  type SentinelResult,
} from "@/server/features/analyze-repo/lib/schemas";
import type {
  RepoMetrics,
  RepositoryFact,
  RepositoryFinding,
} from "@/server/features/analyze-repo/lib/types";
import {
  buildArchitectDigest,
  collectArchitectPreferredPaths,
} from "@/server/features/analyze-repo/model/architect-digest";
import { buildStageContextPack } from "@/server/features/analyze-repo/model/context-manager";
import {
  DOC_SECTION_DEPENDENCIES,
  PRIMARY_DOC_TYPES,
  SECONDARY_DOC_TYPES,
} from "@/server/features/generate-docs/lib/doc-priority";
import {
  buildFallbackApiDocument,
  buildFallbackArchitecture,
  buildFallbackContributing,
  buildFallbackReadme,
} from "@/server/features/generate-docs/lib/fallback-docs";
import type { RepositoryEvidence } from "@/server/shared/engine/core/types";
import { buildDocumentationInputModel } from "@/server/shared/engine/pipeline/documentation-input";
import { prisma } from "@/server/shared/infrastructure/db";
import { githubService } from "@/server/shared/infrastructure/github/github.service";
import { logger } from "@/server/shared/infrastructure/logger";
import { callWithFallback } from "@/server/shared/lib/call";
import { unwrapAiText } from "@/server/shared/lib/optimizers";

import { dumpDebug } from "../../../shared/lib/debug-logger";
import { buildMapperSkeleton } from "./mapper-skeleton";

type StatusUpdater = (msg: string, percent: number, status?: Status) => Promise<void>;
type DocumentationInputSnapshot = NonNullable<RepoMetrics["documentationInput"]>;
type WriterPayload = {
  payload: string;
  sections: readonly string[];
  tier: "primary" | "secondary";
};
type WriterResult = {
  content?: string;
  error?: string;
  name: "api" | "architecture" | "changelog" | "contributing" | "readme";
  status: "failed" | "fallback" | "llm" | "missing";
};

function serializeForWriter(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function hasGeneratedContent(content: string | undefined) {
  return typeof content === "string" && content.trim().length > 0;
}

function summarizeSectionForDebug(
  section: DocumentationInputSnapshot["sections"][keyof DocumentationInputSnapshot["sections"]]
) {
  return {
    confidence: section.confidence,
    evidencePaths: section.evidencePaths,
    unknowns: section.unknowns,
  };
}

function buildSectionDebugSnapshot(documentationInput: DocumentationInputSnapshot) {
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

function buildWriterSectionPayloads(documentationInput: DocumentationInputSnapshot) {
  return {
    api: {
      payload: serializeForWriter(documentationInput.sections.api_reference),
      sections: DOC_SECTION_DEPENDENCIES[DocType.API],
      tier: "primary",
    } satisfies WriterPayload,
    architecture: {
      payload: serializeForWriter(documentationInput.sections.architecture),
      sections: DOC_SECTION_DEPENDENCIES[DocType.ARCHITECTURE],
      tier: "primary",
    } satisfies WriterPayload,
    changelog: {
      payload: "",
      sections: DOC_SECTION_DEPENDENCIES[DocType.CHANGELOG],
      tier: "secondary",
    } satisfies WriterPayload,
    contributing: {
      payload: serializeForWriter({
        onboarding: documentationInput.sections.onboarding,
        overview: documentationInput.sections.overview,
      }),
      sections: DOC_SECTION_DEPENDENCIES[DocType.CONTRIBUTING],
      tier: "secondary",
    } satisfies WriterPayload,
    readme: {
      payload: serializeForWriter({
        architecture: documentationInput.sections.architecture,
        overview: documentationInput.sections.overview,
      }),
      sections: DOC_SECTION_DEPENDENCIES[DocType.README],
      tier: "primary",
    } satisfies WriterPayload,
  };
}

function serializeAllowedPaths(paths: string[]) {
  return JSON.stringify(paths.slice().sort((left, right) => left.localeCompare(right)));
}

function buildWriterPlanDebugSnapshot(
  writerInputs: ReturnType<typeof buildWriterSectionPayloads>,
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

function uniquePaths(paths: string[], max: number) {
  return Array.from(new Set(paths.filter((path) => path.length > 0))).slice(0, max);
}

function buildFallbackAiResult(
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

function buildWriterContextSnapshot(
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

async function runWriterTask(
  name: WriterResult["name"],
  runner: () => Promise<string>
): Promise<WriterResult> {
  try {
    const content = await runner();
    return {
      content,
      name,
      status: content.length > 0 ? "llm" : "missing",
    };
  } catch (error) {
    logger.warn({ error, msg: "Writer stage failed; continuing with partial docs", writer: name });
    return {
      error: error instanceof Error ? error.message : String(error),
      name,
      status: "failed",
    };
  }
}

function buildWriterFallbackReason(name: WriterResult["name"], error?: string) {
  return error != null && error.trim().length > 0
    ? `Writer failed and deterministic fallback was generated from canonical sections. Original error: ${error}`
    : "Writer returned no usable content; deterministic fallback was generated from canonical sections.";
}

function getDocumentationInputSnapshot(evidence: RepositoryEvidence, hardMetrics: RepoMetrics) {
  const documentationInput =
    hardMetrics.documentationInput ?? buildDocumentationInputModel(evidence, hardMetrics);

  dumpDebug("documentation-input-model", {
    model: documentationInput,
    source: hardMetrics.documentationInput != null ? "metrics-cache" : "rebuilt-from-evidence",
  });

  return documentationInput;
}

// Orchestration layer only: it should assemble inputs and call AI stages, not rebuild backend domain logic.
export async function runAiPipeline(
  validFiles: { content: string; path: string }[],
  repositoryFacts: RepositoryFact[],
  repositoryFindings: RepositoryFinding[],
  evidence: RepositoryEvidence,
  hardMetrics: RepoMetrics,
  instructions: string | undefined,
  updateStatus: StatusUpdater,
  analysisId: string,
  language: string
): Promise<AIResult> {
  await updateStatus("Scanning input for threats...", 40);
  let sentinelStatus: "SAFE" | "UNSAFE" = "SAFE";

  if (instructions != null && instructions.length > 5) {
    try {
      const sentinelOut = await callWithFallback<SentinelResult>({
        attemptMetadata: { analysisId, phase: "sentinel" },
        models: AI_MODELS.SENTINEL,
        outputSchema: sentinelSchema,
        prompt: SENTINEL_USER_PROMPT(instructions),
        providerOptions: { google: { codeExecution: true, safetySettings: SAFETY_SETTINGS } },
        system: SENTINEL_SYSTEM_PROMPT,
        temperature: 0.0,
      });
      sentinelStatus = sentinelOut.status;
    } catch (e) {
      logger.warn({ analysisId, error: e, msg: "Sentinel unavailable, defaulting to SAFE" });
      sentinelStatus = "SAFE";
    }
  }
  await updateStatus("Mapping project structure (Step 1/3)...", 45);
  const MAX_MAPPER_CHARS = 380_000;
  const mapContext = buildMapperSkeleton(validFiles, hardMetrics, evidence).slice(
    0,
    MAX_MAPPER_CHARS
  );
  const documentationInput = getDocumentationInputSnapshot(evidence, hardMetrics);
  let projectMap: ProjectMap;

  try {
    projectMap = await callWithFallback<ProjectMap>({
      attemptMetadata: { analysisId, phase: "mapper" },
      models: AI_MODELS.CARTOGRAPHER,
      outputSchema: projectMapSchema,
      prompt: MAPPER_USER_PROMPT(mapContext),
      providerOptions: { google: { codeExecution: true, safetySettings: SAFETY_SETTINGS } },
      system: MAPPER_SYSTEM_PROMPT,
      temperature: 0.05,
    });
  } catch (error) {
    logger.warn({
      analysisId,
      error,
      msg: "Mapper stage failed; continuing with fallback analysis summary",
    });

    return buildFallbackAiResult(
      documentationInput,
      hardMetrics,
      repositoryFacts,
      repositoryFindings,
      error,
      "mapper"
    );
  }

  logger.debug({
    analysisId,
    msg: "Project map generated",
    projectMap: projectMap,
    projectMapSummary: Object.keys(projectMap.modules).length,
  });

  await updateStatus("Deep Analysis & Swagger Gen (Step 2/3)...", 70);
  const architectDigest = buildArchitectDigest(
    documentationInput,
    hardMetrics,
    projectMap,
    repositoryFacts,
    repositoryFindings
  );
  const architectContext = buildStageContextPack({
    files: validFiles,
    preferredPaths: collectArchitectPreferredPaths(architectDigest),
    stage: "architect",
  });

  dumpDebug("architect-budget", architectContext.debug);
  dumpDebug("smart-context-files", {
    stages: {
      architect: {
        budget: architectContext.debug.budgetChars,
        droppedPaths: architectContext.debug.dropped,
        overflowPrevented: architectContext.debug.overflowPrevented,
        selectedByStage: architectContext.debug.selected,
        selectedChars: architectContext.debug.selectedChars,
        selectedEvidencePaths: architectContext.debug.selectedEvidencePaths,
      },
    },
  });
  dumpDebug("architect-input", {
    digest: architectDigest,
    promptChars: architectContext.context.length,
    selectedEvidencePaths: architectContext.debug.selectedEvidencePaths,
    snippetSelection: architectContext.debug.selected,
  });

  try {
    const aiResult = await callWithFallback<AIResult>({
      attemptMetadata: {
        analysisId,
        phase: "architect",
        promptChars: architectContext.context.length + JSON.stringify(architectDigest).length,
      },
      models: [...AI_MODELS.POWERFUL, ...AI_MODELS.ARCHITECT, ...AI_MODELS.FALLBACK],
      outputSchema: aiSchema,
      prompt: ANALYSIS_USER_PROMPT(
        JSON.stringify(architectDigest),
        architectContext.context,
        instructions ?? "Focus on critical business logic and security.",
        sentinelStatus
      ),
      providerOptions: { google: { codeExecution: true, safetySettings: SAFETY_SETTINGS } },
      system: ANALYSIS_SYSTEM_PROMPT(language),
      temperature: 0.1,
    });
    logger.info({ analysisId, msg: "Architect stage completed with compact digest" });

    aiResult.analysisRuntime = {
      ...(aiResult.analysisRuntime ?? {}),
      architect: {
        source: "llm",
        status: "success",
      },
      mapper: {
        source: "llm",
        status: "success",
      },
    };

    return aiResult;
  } catch (error) {
    logger.warn({
      analysisId,
      error,
      msg: "Architect stage failed; continuing with fallback analysis summary",
    });

    return buildFallbackAiResult(
      documentationInput,
      hardMetrics,
      repositoryFacts,
      repositoryFindings,
      error
    );
  }
}

// Writer stage: serializes prebuilt report sections into doc-specific prompts and collects generated outputs.
export async function generateDeepDocs(
  files: { content: string; path: string }[],
  analysisResult: AIResult,
  evidence: RepositoryEvidence,
  hardMetrics: RepoMetrics,
  analysisId: string,
  requestedDocs: DocType[],
  repo: Repo,
  userId: number,
  language: string
) {
  const documentationInput = getDocumentationInputSnapshot(evidence, hardMetrics);
  const writerInputs = buildWriterSectionPayloads(documentationInput);
  const sectionDebugSnapshot = buildSectionDebugSnapshot(documentationInput);
  const writerContexts = {
    api: buildStageContextPack({
      files,
      preferredPaths: uniquePaths(documentationInput.sections.api_reference.evidencePaths, 24),
      stage: "writer_api",
    }),
    architecture: buildStageContextPack({
      files,
      preferredPaths: uniquePaths(
        [
          ...documentationInput.sections.architecture.evidencePaths,
          ...documentationInput.sections.risks.evidencePaths,
          ...documentationInput.sections.onboarding.evidencePaths,
        ],
        28
      ),
      stage: "writer_architecture",
    }),
    readme: buildStageContextPack({
      files,
      preferredPaths: uniquePaths(
        [
          ...documentationInput.sections.overview.evidencePaths,
          ...documentationInput.sections.architecture.evidencePaths,
        ],
        24
      ),
      stage: "writer_readme",
    }),
  };

  dumpDebug("writer-budget", buildWriterContextSnapshot(writerContexts));
  dumpDebug("report-section-inputs", {
    sections: sectionDebugSnapshot,
    writerPlan: buildWriterPlanDebugSnapshot(writerInputs, requestedDocs),
  });

  const allowedPathsByWriter = {
    api: serializeAllowedPaths(
      uniquePaths(
        [
          ...writerContexts.api.debug.selectedEvidencePaths,
          ...documentationInput.sections.api_reference.evidencePaths,
        ],
        48
      )
    ),
    architecture: serializeAllowedPaths(
      uniquePaths(
        [
          ...writerContexts.architecture.debug.selectedEvidencePaths,
          ...documentationInput.sections.architecture.evidencePaths,
          ...documentationInput.sections.risks.evidencePaths,
          ...documentationInput.sections.onboarding.evidencePaths,
        ],
        64
      )
    ),
    readme: serializeAllowedPaths(
      uniquePaths(
        [
          ...writerContexts.readme.debug.selectedEvidencePaths,
          ...documentationInput.sections.overview.evidencePaths,
          ...documentationInput.sections.architecture.evidencePaths,
        ],
        48
      )
    ),
  };

  const tasks: Promise<WriterResult>[] = [];
  const taskMap: Record<string, number> = {};

  // 1. README
  if (requestedDocs.includes(DocType.README)) {
    taskMap["README"] = tasks.length;
    tasks.push(
      runWriterTask(
        "readme",
        async () =>
          await callWithFallback<string>({
            attemptMetadata: {
              analysisId,
              phase: "writer_readme",
              promptChars:
                writerInputs.readme.payload.length + writerContexts.readme.context.length,
            },
            models: AI_MODELS.WRITER,
            outputSchema: null,
            prompt: README_WRITER_USER_PROMPT(
              writerInputs.readme.payload,
              writerContexts.readme.context,
              allowedPathsByWriter.readme
            ),
            providerOptions: { google: { codeExecution: true, safetySettings: SAFETY_SETTINGS } },
            system: README_WRITER_SYSTEM_PROMPT(language),
            temperature: 0.2,
          }).then(unwrapAiText)
      )
    );
  }

  // 2. API DOCS
  if (requestedDocs.includes(DocType.API)) {
    taskMap["API"] = tasks.length;
    tasks.push(
      runWriterTask(
        "api",
        async () =>
          await callWithFallback<string>({
            attemptMetadata: {
              analysisId,
              phase: "writer_api",
              promptChars: writerInputs.api.payload.length + writerContexts.api.context.length,
            },
            models: AI_MODELS.WRITER,
            outputSchema: null,
            prompt: API_WRITER_USER_PROMPT(
              writerInputs.api.payload,
              writerContexts.api.context,
              allowedPathsByWriter.api
            ),
            system: API_WRITER_SYSTEM_PROMPT(language),
            temperature: 0.1,
          }).then(unwrapAiText)
      )
    );
  }

  // 3. ARCHITECTURE
  if (requestedDocs.includes(DocType.ARCHITECTURE)) {
    taskMap["ARCHITECTURE"] = tasks.length;
    tasks.push(
      runWriterTask(
        "architecture",
        async () =>
          await callWithFallback<string>({
            attemptMetadata: {
              analysisId,
              phase: "writer_architecture",
              promptChars:
                writerInputs.architecture.payload.length +
                writerContexts.architecture.context.length,
            },
            models: AI_MODELS.WRITER,
            outputSchema: null,
            prompt: ARCHITECTURE_WRITER_USER_PROMPT(
              writerInputs.architecture.payload,
              serializeForWriter(documentationInput.sections.risks),
              serializeForWriter(documentationInput.sections.onboarding),
              writerContexts.architecture.context,
              allowedPathsByWriter.architecture
            ),
            system: ARCHITECTURE_WRITER_SYSTEM_PROMPT(language),
            temperature: 0.2,
          }).then(unwrapAiText)
      )
    );
  }

  // 4. CONTRIBUTING
  if (requestedDocs.includes(DocType.CONTRIBUTING)) {
    taskMap["CONTRIBUTING"] = tasks.length;
    tasks.push(
      runWriterTask(
        "contributing",
        async () =>
          await callWithFallback<string>({
            attemptMetadata: { analysisId, phase: "writer_contributing" },
            models: AI_MODELS.WRITER,
            outputSchema: null,
            prompt: CONTRIBUTING_WRITER_USER_PROMPT(
              writerInputs.contributing.payload,
              writerContexts.readme.context,
              allowedPathsByWriter.readme
            ),
            system: CONTRIBUTING_WRITER_SYSTEM_PROMPT(language),
            temperature: 0.2,
          }).then(unwrapAiText)
      )
    );
  }

  // 5. CHANGELOG
  if (requestedDocs.includes(DocType.CHANGELOG)) {
    taskMap["CHANGELOG"] = tasks.length;
    tasks.push(
      runWriterTask("changelog", async () => {
        let simpleCommits: Array<{
          author: string | null | undefined;
          date: string | null | undefined;
          message: string;
        }> = [];

        try {
          const { octokit } = await githubService.getClientContext(prisma, userId, repo.owner);
          const { data: commitsData } = await octokit.rest.repos.listCommits({
            owner: repo.owner,
            per_page: 50, // NOTE: тут возможно стоит придумать другую логику
            repo: repo.name,
          });

          simpleCommits = commitsData.map((c: (typeof commitsData)[number]) => ({
            author: c.commit.author?.name,
            date: c.commit.author?.date,
            message: c.commit.message,
          }));
        } catch (error) {
          logger.warn({
            analysisId,
            error,
            msg: "Failed to fetch commits for CHANGELOG. Returning empty string.",
          });
        }

        return await callWithFallback<string>({
          attemptMetadata: { analysisId, phase: "writer_changelog" },
          models: AI_MODELS.WRITER,
          outputSchema: null,
          prompt: CHANGELOG_WRITER_USER_PROMPT(
            JSON.stringify(simpleCommits, null, 2),
            analysisResult.executive_summary.stack_details
          ),
          system: CHANGELOG_WRITER_SYSTEM_PROMPT(language),
          temperature: 0.2,
        }).then(unwrapAiText);
      })
    );
  }

  const results = await Promise.all(tasks);

  let generatedReadme = undefined;
  let generatedApiMarkdown = undefined;
  let swaggerYaml = undefined;
  let generatedContributing = undefined;
  let generatedChangelog = undefined;
  let generatedArchitecture = undefined;
  const writerStatus: NonNullable<AIResult["analysisRuntime"]>["writers"] = {};
  const writerErrors: Partial<Record<WriterResult["name"], string>> = {};
  const writerFallbacks: Partial<Record<WriterResult["name"], string>> = {};

  if ("README" in taskMap) {
    const readmeResult = results[taskMap["README"]];
    generatedReadme = readmeResult.content;
    writerStatus.readme = readmeResult.status;
    if (readmeResult.error != null) writerErrors.readme = readmeResult.error;
  }

  if ("API" in taskMap) {
    const apiResult = results[taskMap["API"]];
    writerStatus.api = apiResult.status;
    if (apiResult.error != null) writerErrors.api = apiResult.error;
    if (apiResult.content != null) {
      const yamlMatch = RegExp(/```yaml([\s\S]*?)```/).exec(apiResult.content);
      if (yamlMatch) {
        swaggerYaml = yamlMatch[1].trim();
        generatedApiMarkdown = apiResult.content
          .replace(/# OpenAPI Specification[\s\S]*/, "")
          .trim();
      } else {
        generatedApiMarkdown = apiResult.content;
      }
    }
  }

  if ("CONTRIBUTING" in taskMap) {
    const contributingResult = results[taskMap["CONTRIBUTING"]];
    generatedContributing = contributingResult.content;
    writerStatus.contributing = contributingResult.status;
    if (contributingResult.error != null) writerErrors.contributing = contributingResult.error;
  }

  if ("CHANGELOG" in taskMap) {
    const changelogResult = results[taskMap["CHANGELOG"]];
    generatedChangelog = changelogResult.content;
    writerStatus.changelog = changelogResult.status;
    if (changelogResult.error != null) writerErrors.changelog = changelogResult.error;
  }

  if ("ARCHITECTURE" in taskMap) {
    const architectureResult = results[taskMap["ARCHITECTURE"]];
    generatedArchitecture = architectureResult.content;
    writerStatus.architecture = architectureResult.status;
    if (architectureResult.error != null) writerErrors.architecture = architectureResult.error;
  }

  if ("README" in taskMap && !hasGeneratedContent(generatedReadme)) {
    generatedReadme = buildFallbackReadme(repo, documentationInput);
    writerStatus.readme = hasGeneratedContent(generatedReadme) ? "fallback" : writerStatus.readme;
    writerFallbacks.readme = buildWriterFallbackReason("readme", writerErrors.readme);
  }

  if ("API" in taskMap && !hasGeneratedContent(generatedApiMarkdown)) {
    generatedApiMarkdown = buildFallbackApiDocument(repo, documentationInput);
    writerStatus.api = hasGeneratedContent(generatedApiMarkdown) ? "fallback" : writerStatus.api;
    writerFallbacks.api = buildWriterFallbackReason("api", writerErrors.api);
  }

  if ("CONTRIBUTING" in taskMap && !hasGeneratedContent(generatedContributing)) {
    generatedContributing = buildFallbackContributing(documentationInput);
    writerStatus.contributing = hasGeneratedContent(generatedContributing)
      ? "fallback"
      : writerStatus.contributing;
    writerFallbacks.contributing = buildWriterFallbackReason(
      "contributing",
      writerErrors.contributing
    );
  }

  if ("ARCHITECTURE" in taskMap && !hasGeneratedContent(generatedArchitecture)) {
    generatedArchitecture = buildFallbackArchitecture(repo, documentationInput);
    writerStatus.architecture = hasGeneratedContent(generatedArchitecture)
      ? "fallback"
      : writerStatus.architecture;
    writerFallbacks.architecture = buildWriterFallbackReason(
      "architecture",
      writerErrors.architecture
    );
  }

  analysisResult.analysisRuntime = {
    ...(analysisResult.analysisRuntime ?? {}),
    writers: writerStatus,
  };
  dumpDebug("report-section-docs", {
    generated: {
      api: {
        hasMarkdown: generatedApiMarkdown != null && generatedApiMarkdown.length > 0,
        hasSpec: swaggerYaml != null && swaggerYaml.length > 0,
      },
      architecture: {
        hasMarkdown: generatedArchitecture != null && generatedArchitecture.length > 0,
      },
      primary: {
        apiReady: generatedApiMarkdown != null && generatedApiMarkdown.length > 0,
        architectureReady: generatedArchitecture != null && generatedArchitecture.length > 0,
        readmeReady: generatedReadme != null && generatedReadme.length > 0,
      },
      readme: {
        hasMarkdown: generatedReadme != null && generatedReadme.length > 0,
      },
      secondary: {
        changelogReady: generatedChangelog != null && generatedChangelog.length > 0,
        contributingReady: generatedContributing != null && generatedContributing.length > 0,
      },
    },
    runtime: analysisResult.analysisRuntime,
    sections: sectionDebugSnapshot,
    writerAllowedPaths: {
      api: JSON.parse(allowedPathsByWriter.api),
      architecture: JSON.parse(allowedPathsByWriter.architecture),
      readme: JSON.parse(allowedPathsByWriter.readme),
    },
    writerErrors,
    writerFallbacks,
    writerPlan: buildWriterPlanDebugSnapshot(writerInputs, requestedDocs),
  });
  dumpDebug("generated-docs-raw", {
    generatedApiMarkdown,
    generatedArchitecture,
    generatedChangelog,
    generatedContributing,
    generatedReadme,
    runtime: analysisResult.analysisRuntime,
    swaggerYaml,
    writerErrors,
    writerFallbacks,
  });

  return {
    generatedApiMarkdown,
    generatedArchitecture,
    generatedChangelog,
    generatedContributing,
    generatedReadme,
    swaggerYaml,
  };
}
