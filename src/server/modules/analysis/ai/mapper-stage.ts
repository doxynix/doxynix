import { google } from "@ai-sdk/google";

import { appLogger } from "@/server/core/app-logger";
import { callWithFallback } from "@/server/utils/call";

import { projectMapSchema, type ProjectMap } from "../engine/core/analysis-result.schemas";
import type { RepositoryEvidence } from "../engine/core/discovery.types";
import type { RepoMetrics } from "../engine/core/metrics.types";
import { buildMapperSkeleton } from "../logic/mapper-skeleton";
import { AI_MODELS, SAFETY_SETTINGS } from "./ai-constants";
import { buildRepositoryTools } from "./ai-tools";
import { buildMapperSystemPrompt, buildMapperUserPrompt } from "./prompts-refactored";

export async function executeMapperPhase(
  validFiles: { content: string; path: string }[],
  hardMetrics: RepoMetrics,
  evidence: RepositoryEvidence,
  analysisId: string,
  userId: number,
  repoId: string,
  branch: string
): Promise<ProjectMap> {
  const MAX_MAPPER_CHARS = 1_500_000;
  const mapContext = buildMapperSkeleton(validFiles, hardMetrics, evidence).slice(
    0,
    MAX_MAPPER_CHARS
  );

  const repoTools = buildRepositoryTools(userId, repoId, branch);

  try {
    const projectMap = await callWithFallback<ProjectMap>({
      attemptMetadata: { analysisId, phase: "mapper" },
      models: AI_MODELS.CARTOGRAPHER,
      outputSchema: projectMapSchema,
      prompt: buildMapperUserPrompt(mapContext),
      providerOptions: {
        google: {
          safetySettings: SAFETY_SETTINGS,
        },
      },
      system: buildMapperSystemPrompt(),

      taskType: "reasoning",

      tools: {
        ...repoTools,
        codeExecution: google.tools.codeExecution({}),
      },
    });

    appLogger.debug({
      analysisId,
      msg: "Project map generated",
      projectMap: projectMap,
      projectMapSummary: Object.keys(projectMap.modules).length,
    });

    return projectMap;
  } catch (error) {
    appLogger.warn({
      analysisId,
      error,
      msg: "Mapper stage failed; continuing with fallback analysis summary",
    });
    throw error;
  }
}
