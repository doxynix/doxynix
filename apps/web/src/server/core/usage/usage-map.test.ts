import { describe, expect, it } from "vitest";

import { totalTokens } from "./price";
import { mapUsageToTokenUsage } from "./usage-map";

describe("mapUsageToTokenUsage", () => {
  it("splits cached input out of the input total for the v7 usage shape", () => {
    const usage = mapUsageToTokenUsage({
      inputTokenDetails: { cacheReadTokens: 400, cacheWriteTokens: 0, noCacheTokens: 600 },
      inputTokens: 1000,
      outputTokens: 100,
    });

    expect(usage).toEqual({ cachedInputTokens: 400, inputTokens: 600, outputTokens: 100 });
    // 600 fresh + 400 cached + 100 output: every prompt token is counted exactly once.
    expect(totalTokens(usage)).toBe(1100);
  });

  it("bills cache writes at the input rate", () => {
    const usage = mapUsageToTokenUsage({
      inputTokenDetails: { cacheReadTokens: 100, cacheWriteTokens: 50, noCacheTokens: 200 },
      inputTokens: 350,
      outputTokens: 10,
    });

    expect(usage).toEqual({ cachedInputTokens: 100, inputTokens: 250, outputTokens: 10 });
  });

  it("still reads the legacy cachedInputTokens field", () => {
    expect(
      mapUsageToTokenUsage({ cachedInputTokens: 400, inputTokens: 1000, outputTokens: 100 }),
    ).toEqual({ cachedInputTokens: 400, inputTokens: 600, outputTokens: 100 });
  });

  it("treats the whole prompt as fresh when no cached count is reported", () => {
    expect(mapUsageToTokenUsage({ inputTokens: 1000, outputTokens: 100 })).toEqual({
      cachedInputTokens: 0,
      inputTokens: 1000,
      outputTokens: 100,
    });
  });

  it("never goes negative when the cached count exceeds the input total", () => {
    expect(mapUsageToTokenUsage({ cachedInputTokens: 900, inputTokens: 100 })).toEqual({
      cachedInputTokens: 900,
      inputTokens: 0,
      outputTokens: 0,
    });
  });

  it("is zero for a missing usage", () => {
    expect(mapUsageToTokenUsage(undefined)).toEqual({
      cachedInputTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
    });
    expect(mapUsageToTokenUsage(null)).toEqual({
      cachedInputTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
    });
  });
});
