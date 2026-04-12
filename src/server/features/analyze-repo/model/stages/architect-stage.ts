import { aiSchema, type AIResult } from "@/server/shared/engine/core/analysis-result.schemas";
import { logger } from "@/server/shared/infrastructure/logger";
import { callWithFallback } from "@/server/shared/lib/call";
import { dumpDebug } from "@/server/shared/lib/debug-logger";

import { AI_MODELS, SAFETY_SETTINGS } from "../../lib/constants";
import { ANALYSIS_SYSTEM_PROMPT, ANALYSIS_USER_PROMPT } from "../../lib/prompts-refactored";
import { collectArchitectPreferredPaths, type buildArchitectDigest } from "../architect-digest";
import { buildStageContextPack } from "../context-manager";

export async function executeArchitectPhase(
  validFiles: { content: string; path: string }[],
  documentationDigest: ReturnType<typeof buildArchitectDigest>,
  analysisId: string,
  instructions: string | undefined,
  sentinelStatus: "SAFE" | "UNSAFE",
  language: string
): Promise<AIResult> {
  const architectContext = buildStageContextPack({
    files: validFiles,
    preferredPaths: collectArchitectPreferredPaths(documentationDigest),
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
    digest: documentationDigest,
    promptChars: architectContext.context.length,
    selectedEvidencePaths: architectContext.debug.selectedEvidencePaths,
    snippetSelection: architectContext.debug.selected,
  });

  try {
    const aiResult = await callWithFallback<AIResult>({
      attemptMetadata: {
        analysisId,
        phase: "architect",
        promptChars: architectContext.context.length + JSON.stringify(documentationDigest).length,
      },
      models: [...AI_MODELS.POWERFUL, ...AI_MODELS.ARCHITECT, ...AI_MODELS.FALLBACK],
      outputSchema: aiSchema,
      prompt: ANALYSIS_USER_PROMPT(
        JSON.stringify(documentationDigest),
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
      ...aiResult.analysisRuntime,
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
    throw error;
  }
}
