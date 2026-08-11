import { fromPreTrained } from "@lenml/tokenizer-gemma2";

import { appLogger } from "@/server/core/app-logger";

import { hasText } from "./string-utils";

let tokenizer: null | ReturnType<typeof fromPreTrained> = null;

try {
  tokenizer = fromPreTrained();
} catch (error) {
  appLogger.error({ error, msg: "Failed to initialize native Gemma tokenizer, using fallback." });
}

function calculateHeuristicTokens(text: string): number {
  const totalChars = text.length;

  const cjkMatch = text.match(/[\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]/g);
  const cjkCount = cjkMatch != null ? cjkMatch.length : 0;

  const complexAlphaMatch = text.match(/[\u0370-\u04FF\u0590-\u06FF]/g);
  const complexAlphaCount = complexAlphaMatch != null ? complexAlphaMatch.length : 0;

  const standardAsciiCount = totalChars - cjkCount - complexAlphaCount;

  const estimatedCjkTokens = cjkCount / 1.2;
  const estimatedComplexAlphaTokens = complexAlphaCount / 2.0;
  const estimatedAsciiTokens = standardAsciiCount / 3.8;

  return Math.ceil(estimatedCjkTokens + estimatedComplexAlphaTokens + estimatedAsciiTokens);
}

export async function countTokens(text: string): Promise<number> {
  if (!hasText(text)) return 0;

  if (tokenizer == null) {
    appLogger.warn({
      msg: "countTokens is operating in degraded mode: tokenizer is null. Using heuristic fallback",
    });
    return calculateHeuristicTokens(text);
  }

  try {
    return tokenizer.encode(text).length;
  } catch (error) {
    appLogger.error({
      error,
      msg: "Runtime error during token encoding, falling back to heuristic:",
    });
    return calculateHeuristicTokens(text);
  }
}
