import type { TokenUsage } from "./price";

// Structural subset of the SDK's `LanguageModelUsage`; declared locally so a caller does not have
// to import the provider SDK just to meter a call.
export type MeterUsage = {
  inputTokenDetails?: {
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    noCacheTokens?: number;
  };
  inputTokens?: number;
  outputTokens?: number;
};

// The SDK reports cache hits inside `inputTokenDetails`; without it every input token is uncached.
export function mapUsageToTokenUsage(usage: MeterUsage | null | undefined): TokenUsage {
  const cachedInputTokens = usage?.inputTokenDetails?.cacheReadTokens ?? 0;
  const cacheWriteTokens = usage?.inputTokenDetails?.cacheWriteTokens ?? 0;
  const noCacheTokens = usage?.inputTokenDetails?.noCacheTokens ?? usage?.inputTokens ?? 0;

  return {
    cachedInputTokens,
    // Cache writes have no separate price class, so they are billed at the input rate.
    inputTokens: noCacheTokens + cacheWriteTokens,
    outputTokens: usage?.outputTokens ?? 0,
  };
}
