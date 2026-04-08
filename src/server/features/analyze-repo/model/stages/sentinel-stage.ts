import { AI_MODELS, SAFETY_SETTINGS } from "@/server/features/analyze-repo/lib/constants";
import {
  SENTINEL_SYSTEM_PROMPT,
  SENTINEL_USER_PROMPT,
} from "@/server/features/analyze-repo/lib/prompts-refactored";
import {
  sentinelSchema,
  type SentinelResult,
} from "@/server/shared/engine/core/analysis-result.schemas";
import { logger } from "@/server/shared/infrastructure/logger";
import { callWithFallback } from "@/server/shared/lib/call";

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

  return sentinelStatus;
}
