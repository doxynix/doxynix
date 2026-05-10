import { appLogger } from "@/server/core/app-logger";
import { callWithFallback } from "@/server/utils/call";

import { sentinelSchema, type SentinelResult } from "../engine/core/analysis-result.schemas";
import { AI_MODELS, SAFETY_SETTINGS } from "./ai-constants";
import { SENTINEL_SYSTEM_PROMPT, SENTINEL_USER_PROMPT } from "./prompts-refactored";

export async function executeSentinelPhase(
  instructions: string | undefined,
  analysisId: string
): Promise<"SAFE" | "UNSAFE"> {
  let sentinelStatus: "SAFE" | "UNSAFE" = "SAFE";

  if (instructions != null && instructions.length > 5) {
    try {
      const sentinelOut = await callWithFallback<SentinelResult>({
        attemptMetadata: { analysisId, phase: "sentinel" },
        models: AI_MODELS.SENTINEL,
        outputSchema: sentinelSchema,
        prompt: SENTINEL_USER_PROMPT(instructions),
        providerOptions: { google: { safetySettings: SAFETY_SETTINGS } },
        system: SENTINEL_SYSTEM_PROMPT,
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
