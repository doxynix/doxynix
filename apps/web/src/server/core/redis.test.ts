import { afterEach, describe, expect, it, vi } from "vitest";

// --- Hoisted mocks ---
const mocks = vi.hoisted(() => {
  const mockRedis = {
    del: vi.fn(),
    expire: vi.fn(),
    get: vi.fn(),
    getdel: vi.fn(),
    hdel: vi.fn(),
    hgetall: vi.fn(),
    hlen: vi.fn(),
    hset: vi.fn(),
    set: vi.fn(),
  };
  return {
    appLogger: { debug: vi.fn(), error: vi.fn(), flush: vi.fn(), info: vi.fn(), warn: vi.fn() },
    mockRedis,
  };
});

vi.mock("@upstash/redis", () => ({
  Redis: {
    fromEnv: () => mocks.mockRedis,
  },
}));

vi.mock("./app-logger", () => ({
  appLogger: mocks.appLogger,
}));

import { REDIS_CONFIG } from "@/server/utils/redis";

import { appLogger } from "./app-logger";
import { redisService } from "./redis";

const { mockRedis } = mocks;

afterEach(() => {
  mocks.mockRedis.del.mockClear();
  mocks.mockRedis.get.mockClear();
  mocks.mockRedis.getdel.mockClear();
  mocks.mockRedis.set.mockClear();
  mocks.mockRedis.hset.mockClear();
  mocks.mockRedis.expire.mockClear();
  mocks.mockRedis.hlen.mockClear();
  mocks.mockRedis.hgetall.mockClear();
  mocks.mockRedis.hdel.mockClear();
  mocks.appLogger.debug.mockClear();
  mocks.appLogger.error.mockClear();
  mocks.appLogger.info.mockClear();
  mocks.appLogger.warn.mockClear();
});

// ---------------------------------------------------------------------------
// authStorage
// ---------------------------------------------------------------------------
describe("redisService.authStorage", () => {
  describe("get", () => {
    it("returns string value as-is", async () => {
      mockRedis.get.mockResolvedValue("token-abc");

      const result = await redisService.authStorage.get("key");

      expect(result).toBe("token-abc");
      expect(mockRedis.get).toHaveBeenCalledWith("key");
    });

    it.each([
      { expected: "42", label: "number", value: 42 },
      { expected: '{"a":1}', label: "object", value: { a: 1 } },
    ])("converts non-string ($label) via JSON.stringify", async ({ expected, value }) => {
      mockRedis.get.mockResolvedValue(value);

      const result = await redisService.authStorage.get("key");

      expect(result).toBe(expected);
    });

    it("returns null when value is null", async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await redisService.authStorage.get("key");

      expect(result).toBeNull();
    });

    it("rethrows error and logs", async () => {
      const error = new Error("redis down");
      mockRedis.get.mockRejectedValue(error);

      await expect(redisService.authStorage.get("key")).rejects.toThrow(error);

      expect(appLogger.error).toHaveBeenCalledWith({
        error: "redis down",
        key: "key",
        msg: "Redis secondaryStorage get error",
      });
    });
  });

  describe("set", () => {
    it("sets string value without ttl", async () => {
      await redisService.authStorage.set("k", "v");

      expect(mockRedis.set).toHaveBeenCalledWith("k", "v");
    });

    it("stringifies non-string values", async () => {
      const obj = { foo: "bar" };
      await redisService.authStorage.set("k", obj);

      expect(mockRedis.set).toHaveBeenCalledWith("k", JSON.stringify(obj));
    });

    it("applies ttl when provided", async () => {
      await redisService.authStorage.set("k", "v", 300);

      expect(mockRedis.set).toHaveBeenCalledWith("k", "v", { ex: 300 });
    });
  });

  describe("getAndDelete", () => {
    it("returns string value as-is via getdel", async () => {
      mockRedis.getdel.mockResolvedValue("token");

      const result = await redisService.authStorage.getAndDelete("k");

      expect(result).toBe("token");
      expect(mockRedis.getdel).toHaveBeenCalledWith("k");
    });

    it("returns null when value is null", async () => {
      mockRedis.getdel.mockResolvedValue(null);

      const result = await redisService.authStorage.getAndDelete("k");

      expect(result).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// fileActions
// ---------------------------------------------------------------------------
describe("redisService.fileActions", () => {
  const fixture = {
    action: "document-file-preview" as const,
    analysisRef: null,
    confidence: "high" as const,
    consistency: "matched" as const,
    consistencyNote: null,
    content: "x",
    contextDiagnostics: {
      contextStrength: "none" as const,
      graphNeighborCount: 0,
      hasContext: false,
      neighborPathCount: 0,
      nextSuggestedPathCount: 0,
      nonEmptyBuckets: [],
      recommendedActionCount: 0,
      sourcePathCount: 0,
    },
    contextMeta: {
      confidence: null,
      graphBacked: false,
      mode: "none" as const,
      nodeId: null,
      source: "none" as const,
      title: null,
    },
    path: "a.ts",
    summary: "summary",
    title: "title",
  };

  it("set stores data with fileAction TTL", async () => {
    await redisService.fileActions.set(1, "a.ts", "document-file-preview", fixture);

    expect(mockRedis.set).toHaveBeenCalledWith(
      REDIS_CONFIG.keys.fileAction(1, "a.ts", "document-file-preview"),
      fixture,
      { ex: REDIS_CONFIG.ttl.fileAction },
    );
  });

  it("get returns parsed result", async () => {
    mockRedis.get.mockResolvedValue(fixture);

    const result = await redisService.fileActions.get(1, "a.ts", "document-file-preview");

    expect(result).toEqual(fixture);
  });

  it("get returns null when value is null", async () => {
    mockRedis.get.mockResolvedValue(null);

    const result = await redisService.fileActions.get(1, "a.ts", "quick-file-audit");

    expect(result).toBeNull();
  });

  it("get returns fallback null on error (no rethrow)", async () => {
    mockRedis.get.mockRejectedValue(new Error("fail"));

    const result = await redisService.fileActions.get(1, "a.ts", "document-file-preview");

    expect(result).toBeNull();
    expect(appLogger.error).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// fixes
// ---------------------------------------------------------------------------
describe("redisService.fixes", () => {
  it("set uses fixResult key with TTL", async () => {
    await redisService.fixes.set("fix-123", { code: "ok" });

    expect(mockRedis.set).toHaveBeenCalledWith(
      REDIS_CONFIG.keys.fixResult("fix-123"),
      { code: "ok" },
      { ex: REDIS_CONFIG.ttl.fixResult },
    );
  });

  it("get returns result or null", async () => {
    mockRedis.get.mockResolvedValue(null);
    const result = await redisService.fixes.get("fix-123");
    expect(result).toBeNull();
  });

  it("get returns fallback null on error", async () => {
    mockRedis.get.mockRejectedValue(new Error("err"));
    const result = await redisService.fixes.get("fix-123");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// staging
// ---------------------------------------------------------------------------
describe("redisService.staging", () => {
  it("addFiles calls hset, expire, and returns hlen", async () => {
    mockRedis.hlen.mockResolvedValue(2);

    const result = await redisService.staging.addFiles(1, "repo-1", { "a.ts": "content" });

    expect(mockRedis.hset).toHaveBeenCalledWith(REDIS_CONFIG.keys.prStaging(1, "repo-1"), {
      "a.ts": "content",
    });
    expect(mockRedis.expire).toHaveBeenCalledWith(
      REDIS_CONFIG.keys.prStaging(1, "repo-1"),
      REDIS_CONFIG.ttl.prStaging,
    );
    expect(result).toBe(2);
  });

  it("getAll returns empty array for empty hgetall", async () => {
    mockRedis.hgetall.mockResolvedValue({});

    const result = await redisService.staging.getAll(1, "repo-1");

    expect(result).toEqual([]);
  });

  it("getAll maps hgetall entries to StagedFile array", async () => {
    mockRedis.hgetall.mockResolvedValue({ "a.ts": "x", "b.ts": "y" });

    const result = await redisService.staging.getAll(1, "repo-1");

    expect(result).toEqual(
      expect.arrayContaining([
        { content: "x", filePath: "a.ts" },
        { content: "y", filePath: "b.ts" },
      ]),
    );
    expect(result).toHaveLength(2);
  });

  it("getAll returns empty array when hgetall is null", async () => {
    mockRedis.hgetall.mockResolvedValue(null);

    const result = await redisService.staging.getAll(1, "repo-1");

    expect(result).toEqual([]);
  });

  it("removeFile calls hdel and returns hlen", async () => {
    mockRedis.hlen.mockResolvedValue(1);

    const result = await redisService.staging.removeFile(1, "repo-1", "a.ts");

    expect(mockRedis.hdel).toHaveBeenCalledWith(REDIS_CONFIG.keys.prStaging(1, "repo-1"), "a.ts");
    expect(result).toBe(1);
  });

  it("clear calls del", async () => {
    await redisService.staging.clear(1, "repo-1");

    expect(mockRedis.del).toHaveBeenCalledWith(REDIS_CONFIG.keys.prStaging(1, "repo-1"));
  });

  it("addFiles rethrows on error and logs (rethrow: true)", async () => {
    mockRedis.hset.mockRejectedValue(new Error("fail"));

    await expect(redisService.staging.addFiles(1, "repo-1", { "a.ts": "x" })).rejects.toThrow(
      "fail",
    );

    expect(appLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ msg: "Redis staging.addFiles failed" }),
    );
  });
});
