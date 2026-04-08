import { AI_MODELS, SAFETY_SETTINGS } from "@/server/features/analyze-repo/lib/constants";
import {
  MAPPER_SYSTEM_PROMPT,
  MAPPER_USER_PROMPT,
} from "@/server/features/analyze-repo/lib/prompts-refactored";
import {
  projectMapSchema,
  type ProjectMap,
} from "@/server/shared/engine/core/analysis-result.schemas";
import type { RepositoryEvidence } from "@/server/shared/engine/core/discovery.types";
import type { RepoMetrics } from "@/server/shared/engine/core/metrics.types";
import { logger } from "@/server/shared/infrastructure/logger";
import { callWithFallback } from "@/server/shared/lib/call";

import { buildMapperSkeleton } from "../mapper-skeleton";

export async function executeMapperPhase(
  validFiles: { content: string; path: string }[],
  hardMetrics: RepoMetrics,
  evidence: RepositoryEvidence,
  analysisId: string
): Promise<ProjectMap> {
  const MAX_MAPPER_CHARS = 380_000;
  const mapContext = buildMapperSkeleton(validFiles, hardMetrics, evidence).slice(
    0,
    MAX_MAPPER_CHARS
  );

  try {
    const projectMap = await callWithFallback<ProjectMap>({
      attemptMetadata: { analysisId, phase: "mapper" },
      models: AI_MODELS.CARTOGRAPHER,
      outputSchema: projectMapSchema,
      prompt: MAPPER_USER_PROMPT(mapContext),
      providerOptions: { google: { codeExecution: true, safetySettings: SAFETY_SETTINGS } },
      system: MAPPER_SYSTEM_PROMPT,
      temperature: 0.05,
    });

    logger.debug({
      analysisId,
      msg: "Project map generated",
      projectMap: projectMap,
      projectMapSummary: Object.keys(projectMap.modules).length,
    });

    return projectMap;
  } catch (error) {
    logger.warn({
      analysisId,
      error,
      msg: "Mapper stage failed; continuing with fallback analysis summary",
    });
    throw error;
  }
}
