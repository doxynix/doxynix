import { beforeEach, describe, expect, it, vi } from "vitest";

const { del, get, getdel, set } = vi.hoisted(() => ({
  del: vi.fn(),
  get: vi.fn(),
  getdel: vi.fn(),
  set: vi.fn(),
}));

vi.mock("@upstash/redis", () => ({
  Redis: { fromEnv: () => ({ del, get, getdel, set }) },
}));

vi.mock("./app-logger", () => ({
  appLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { redisService } from "./redis";

const OUTAGE = new Error("Failed to parse URL from /pipeline");

// The asymmetry is the whole point: a failed read is a cache miss, a failed write is a real fault.
// `delete` rethrows so `revokeSessions` records that Redis still serves a session the database revoked.
describe("authStorage when Redis is unreachable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    del.mockRejectedValue(OUTAGE);
    get.mockRejectedValue(OUTAGE);
    getdel.mockRejectedValue(OUTAGE);
    set.mockRejectedValue(OUTAGE);
  });

  it("resolves a read to a miss instead of throwing, so the declared fallback is reachable", async () => {
    await expect(redisService.authStorage.get("session:abc")).resolves.toBeNull();
    await expect(redisService.authStorage.getAndDelete("session:abc")).resolves.toBeNull();
  });

  it("propagates a failed delete, leaving the cache mismatch visible to the operator", async () => {
    await expect(redisService.authStorage.delete("session:abc")).rejects.toThrow(OUTAGE);
  });

  it("propagates a failed write, since an uncached session cannot be read back", async () => {
    await expect(redisService.authStorage.set("session:abc", "value")).rejects.toThrow(OUTAGE);
  });
});

describe("authStorage when Redis is healthy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    del.mockResolvedValue(1);
    get.mockResolvedValue('{"ok":true}');
    getdel.mockResolvedValue('{"ok":true}');
    set.mockResolvedValue("OK");
  });

  it("returns the cached value as a string and deletes without throwing", async () => {
    await expect(redisService.authStorage.get("session:abc")).resolves.toBe('{"ok":true}');
    await expect(redisService.authStorage.delete("session:abc")).resolves.toBeUndefined();
  });

  it("reports a miss as null rather than as an error", async () => {
    get.mockResolvedValue(null);

    await expect(redisService.authStorage.get("session:absent")).resolves.toBeNull();
  });
});
