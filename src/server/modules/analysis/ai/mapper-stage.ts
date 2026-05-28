import { appLogger } from "@/server/core/app-logger";
import { google } from "@/server/core/google";
import { callWithFallback } from "@/server/utils/call";

import {
  isSchemaMismatchError,
  normalizeProjectMapOutput,
  projectMapGenerationSchema,
} from "../engine/core/ai-result-normalize";
import type { ProjectMap } from "../engine/core/analysis-result.schemas";
import type { RepositoryEvidence } from "../engine/core/discovery.types";
import type { RepoMetrics } from "../engine/core/metrics.types";
import { buildMapperSkeleton } from "../logic/mapper-skeleton";
import { getActiveModels, SAFETY_SETTINGS } from "./ai-constants";
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
  const activeModels = await getActiveModels();

  try {
    const raw = await callWithFallback<unknown>({
      attemptMetadata: { analysisId, phase: "mapper" },
      models: activeModels.CARTOGRAPHER,
      outputSchema: projectMapGenerationSchema,
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

    const projectMap = normalizeProjectMapOutput(raw);

    appLogger.debug({
      analysisId,
      msg: "Project map generated",
      projectMap: projectMap,
      projectMapSummary: Object.keys(projectMap.modules).length,
    });

    return projectMap;
  } catch (error) {
    if (isSchemaMismatchError(error)) {
      appLogger.warn({
        analysisId,
        error,
        msg: "Mapper schema mismatch; using skeleton fallback",
      });
      return normalizeProjectMapOutput({
        modules: hardMetrics.documentationInput?.architecture.modules.map((module) => ({
          path: module.path,
          responsibility: module.categories.join(", ") || "Core module",
          type: module.categories[0] ?? "module",
        })),
        overview: "Topology inferred from static analysis after mapper schema mismatch.",
      });
    }

    appLogger.warn({
      analysisId,
      error,
      msg: "Mapper stage failed",
    });
    throw error;
  }
}
