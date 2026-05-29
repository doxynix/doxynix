import { appLogger } from "@/server/core/app-logger";
import { callWithFallback } from "@/server/utils/call";

import { sentinelSchema, type SentinelResult } from "../engine/core/analysis-result.schemas";
import { getActiveModels, SAFETY_SETTINGS } from "./ai-constants";
import { buildSentinelSystemPrompt, buildSentinelUserPrompt } from "./prompts-refactored";

export async function executeSentinelPhase(
  instructions: string | undefined,
  analysisId: string
): Promise<"SAFE" | "UNSAFE"> {
  let sentinelStatus: "SAFE" | "UNSAFE" = "SAFE";

  if (instructions != null && instructions.length > 5) {
    try {
      const activeModels = await getActiveModels();

      const sentinelOut = await callWithFallback<SentinelResult>({
        attemptMetadata: { analysisId, phase: "sentinel" },
        models: activeModels.SENTINEL,
        outputSchema: sentinelSchema,
        prompt: buildSentinelUserPrompt(instructions),
        providerOptions: { google: { safetySettings: SAFETY_SETTINGS } },
        system: buildSentinelSystemPrompt(),
        taskType: "classification",
      });
      sentinelStatus = sentinelOut.status;
    } catch (error) {
      appLogger.warn({ analysisId, error: error, msg: "Sentinel unavailable, defaulting to SAFE" });
      sentinelStatus = "SAFE";
    }
  }

  return sentinelStatus;
}
