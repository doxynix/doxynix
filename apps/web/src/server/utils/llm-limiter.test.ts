import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockLimit, MockRatelimit } = vi.hoisted(() => {
  const mockLimit = vi.fn();

  class MockRatelimit {
    limit = mockLimit;

    static slidingWindow = vi.fn(() => ({ type: "sliding-window" }));
  }

  return { MockRatelimit, mockLimit };
});

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: MockRatelimit,
}));

vi.mock("@/server/core/app-logger", () => ({
  appLogger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@/server/core/redis", () => ({
  redisClient: {},
}));

import { appLogger } from "@/server/core/app-logger";

import { llmLimiter } from "./llm-limiter";

describe("server/utils/llm-limiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockLimit.mockResolvedValue({ reset: Date.now() + 5000, success: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("validation", () => {
    it("accepts valid work with a positive weight", async () => {
      await expect(llmLimiter.schedule({ id: "demo", weight: 12 }, async () => "ok")).resolves.toBe(
        "ok",
      );
    });

    it("rejects non-positive weights (0, negative, NaN, Infinity) before scheduling", async () => {
      await expect(
        llmLimiter.schedule({ id: "demo", weight: 0 }, async () => "never"),
      ).rejects.toThrow("Invalid LLM request weight: must be a positive finite number");

      await expect(
        llmLimiter.schedule({ id: "demo", weight: -10 }, async () => "never"),
      ).rejects.toThrow("Invalid LLM request weight: must be a positive finite number");

      await expect(
        llmLimiter.schedule({ id: "demo", weight: Number.NaN }, async () => "never"),
      ).rejects.toThrow("Invalid LLM request weight: must be a positive finite number");

      await expect(
        llmLimiter.schedule({ id: "demo", weight: Number.POSITIVE_INFINITY }, async () => "never"),
      ).rejects.toThrow("Invalid LLM request weight: must be a positive finite number");
    });

    it("clamps request weight to max capacity (230,000)", async () => {
      await llmLimiter.schedule({ id: "heavy", weight: 500_000 }, async () => "done");

      expect(mockLimit).toHaveBeenCalledWith("global-llm-tpm", { rate: 230_000 });
    });
  });

  describe("rate-limiting retry flow", () => {
    it("backs off and retries when rate limit is hit, then admits on subsequent attempt", async () => {
      mockLimit
        .mockResolvedValueOnce({ reset: Date.now() + 4000, success: false })
        .mockResolvedValueOnce({ reset: Date.now() + 4000, success: true });

      const task = vi.fn().mockResolvedValue("result-after-retry");

      const schedulePromise = llmLimiter.schedule({ id: "retry-task", weight: 1000 }, task);

      await vi.advanceTimersByTimeAsync(10_000);

      const result = await schedulePromise;
      expect(result).toBe("result-after-retry");

      expect(appLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          baseRequestId: "retry-task",
          msg: expect.stringContaining("LLM Rate limit reached (TPM). Attempt 1/15"),
        }),
      );

      expect(appLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          baseRequestId: "retry-task",
          msg: "LLM request admitted after 2 rate-limiting attempts",
        }),
      );
    });

    it("throws error when max attempts (15) are exceeded", async () => {
      mockLimit.mockResolvedValue({ reset: Date.now() + 3000, success: false });

      const task = vi.fn().mockResolvedValue("never");

      const schedulePromise = llmLimiter.schedule({ id: "exhaust-task", weight: 500 }, task);
      void schedulePromise.catch(() => {});

      await vi.runAllTimersAsync();

      await expect(schedulePromise).rejects.toThrow(
        "LLM Rate limit reached (TPM). Max retry attempts (15) exceeded.",
      );
      expect(task).not.toHaveBeenCalled();
    });
  });

  describe("fail-open and error handling", () => {
    it("logs error and delays retry when Upstash throws fewer than 3 times", async () => {
      mockLimit
        .mockRejectedValueOnce(new Error("Redis connection dropped"))
        .mockResolvedValueOnce({ reset: Date.now() + 3000, success: true });

      const task = vi.fn().mockResolvedValue("recovered");

      const schedulePromise = llmLimiter.schedule({ id: "fail-once", weight: 200 }, task);
      await vi.advanceTimersByTimeAsync(4000);

      const result = await schedulePromise;
      expect(result).toBe("recovered");

      expect(appLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "fail-once",
          msg: expect.stringContaining("Upstash Ratelimit API error (Failure 1/3)"),
        }),
      );
    });

    it("activates Fail-Open bypass after 3 consecutive Upstash errors to protect execution", async () => {
      mockLimit
        .mockRejectedValueOnce(new Error("Redis error 1"))
        .mockRejectedValueOnce(new Error("Redis error 2"))
        .mockRejectedValueOnce(new Error("Redis error 3"));

      const task = vi.fn().mockResolvedValue("executed-via-fail-open");

      const schedulePromise = llmLimiter.schedule({ id: "fail-open-task", weight: 300 }, task);
      await vi.advanceTimersByTimeAsync(10_000);

      const result = await schedulePromise;
      expect(result).toBe("executed-via-fail-open");

      expect(appLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          baseRequestId: "fail-open-task",
          msg: expect.stringContaining("Activating Fail-Open bypass"),
        }),
      );
    });
  });

  describe("task execution and Google 429 sync drift recovery", () => {
    it("rethrows non-rate-limit task errors immediately", async () => {
      const task = vi.fn().mockRejectedValue(new Error("Standard database query failed"));

      await expect(llmLimiter.schedule({ id: "db-fail", weight: 100 }, task)).rejects.toThrow(
        "Standard database query failed",
      );
    });

    it("catches 429 status and retries task using parsed seconds from error message", async () => {
      const rateLimitError = new Error("Resource exhausted: Please retry in 3.5s");
      Object.assign(rateLimitError, { status: 429 });

      const task = vi
        .fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce("recovered-after-drift");

      const schedulePromise = llmLimiter.schedule({ id: "drift-test", weight: 500 }, task);
      await vi.advanceTimersByTimeAsync(5000);

      const result = await schedulePromise;
      expect(result).toBe("recovered-after-drift");
      expect(task).toHaveBeenCalledTimes(2);

      expect(appLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          baseRequestId: "drift-test",
          msg: expect.stringContaining("Retrying after parsed backoff of 4s"),
        }),
      );
    });

    it("parses retry-after from Headers object with .get() method", async () => {
      const rateLimitError = {
        headers: {
          get: vi.fn((key: string) => (key === "retry-after" ? "8" : null)),
        },
        status: 429,
      };

      const task = vi
        .fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce("success-headers-get");

      const schedulePromise = llmLimiter.schedule({ id: "headers-get-test", weight: 500 }, task);
      await vi.advanceTimersByTimeAsync(10_000);

      const result = await schedulePromise;
      expect(result).toBe("success-headers-get");
      expect(task).toHaveBeenCalledTimes(2);
    });

    it("parses retry-after from plain headers object dictionary", async () => {
      const rateLimitError = {
        headers: { "retry-after": "6.2" },
        status: 429,
      };

      const task = vi
        .fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce("success-headers-dict");

      const schedulePromise = llmLimiter.schedule({ id: "headers-dict-test", weight: 500 }, task);
      await vi.advanceTimersByTimeAsync(8000);

      const result = await schedulePromise;
      expect(result).toBe("success-headers-dict");
    });

    it("parses retry time from string error and uses fallback 15s when unparseable", async () => {
      const unparseableError = {
        message: "RESOURCE_EXHAUSTED without timing info",
        statusCode: 429,
      };

      const task = vi
        .fn()
        .mockRejectedValueOnce(unparseableError)
        .mockResolvedValueOnce("success-fallback-15s");

      const schedulePromise = llmLimiter.schedule({ id: "fallback-test", weight: 500 }, task);
      await vi.advanceTimersByTimeAsync(16_000);

      const result = await schedulePromise;
      expect(result).toBe("success-fallback-15s");
      expect(appLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          baseRequestId: "fallback-test",
          msg: expect.stringContaining("Retrying after parsed backoff of 15s"),
        }),
      );
    });

    it("parses 'retry after Xs' format correctly", async () => {
      const stringError = "Google API: retrying after 2.5s";
      const errorObj = { message: stringError, statusCode: 429 };

      const task = vi
        .fn()
        .mockRejectedValueOnce(errorObj)
        .mockResolvedValueOnce("success-after-pattern");

      const schedulePromise = llmLimiter.schedule({ id: "pattern-test", weight: 500 }, task);
      await vi.advanceTimersByTimeAsync(4000);

      const result = await schedulePromise;
      expect(result).toBe("success-after-pattern");
    });
  });
});
