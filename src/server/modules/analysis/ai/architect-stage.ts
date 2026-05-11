import { google } from "@ai-sdk/google";

import { appLogger } from "@/server/core/app-logger";
import { callWithFallback } from "@/server/utils/call";
import { dumpDebug } from "@/server/utils/debug-logger";
import { taskLogger } from "@/server/utils/task-logger";

import { aiSchema, type AIResult } from "../engine/core/analysis-result.schemas";
import {
  collectArchitectPreferredPaths,
  type buildArchitectDigest,
} from "../logic/architect-digest";
import { buildStageContextPack } from "../logic/context-manager";
import { AI_MODELS, SAFETY_SETTINGS } from "./ai-constants";
import { buildRepositoryTools } from "./ai-tools";
import { buildAnalysisSystemPrompt, buildAnalysisUserPrompt } from "./prompts-refactored";

export async function executeArchitectPhase(
  validFiles: { content: string; path: string }[],
  documentationDigest: ReturnType<typeof buildArchitectDigest>,
  analysisId: string,
  instructions: string | undefined,
  sentinelStatus: "SAFE" | "UNSAFE",
  language: string,
  userId: number,
  repoId: string,
  branch: string
): Promise<AIResult> {
  taskLogger.info("Architect: Building final intelligence report...");

  const architectContext = await buildStageContextPack({
    files: validFiles,
    preferredPaths: collectArchitectPreferredPaths(documentationDigest),
    stage: "architect",
  });

  taskLogger.info(
    `Architect: Context assembled (${architectContext.debug.selectedTokens} tokens). Starting reasoning...`
  );

  const repoTools = buildRepositoryTools(userId, repoId, branch);

  void dumpDebug("architect-budget", architectContext.debug);
  void dumpDebug("smart-context-files", {
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
  void dumpDebug("architect-input", {
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
      prompt: buildAnalysisUserPrompt(
        JSON.stringify(documentationDigest),
        architectContext.context,
        instructions ?? "Focus on critical business logic and security.",
        sentinelStatus
      ),
      providerOptions: { google: { safetySettings: SAFETY_SETTINGS } },
      system: buildAnalysisSystemPrompt(language),
      taskType: "reasoning",
      tools: {
        ...repoTools,
        codeExecution: google.tools.codeExecution({}),
      },
    });

    taskLogger.success("Architect: Analysis complete. System patterns and risks identified.");

    appLogger.info({ analysisId, msg: "Architect stage completed with compact digest" });

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
    taskLogger.error("Architect: Critical failure during reasoning phase.");

    appLogger.warn({
      analysisId,
      error,
      msg: "Architect stage failed; continuing with fallback analysis summary",
    });
    throw error;
  }
}
