import { describe, expect, it, vi } from "vitest";

import { memoizeOnce } from "./request-memo";

function newStore() {
  return new Map<string, Promise<unknown>>();
}

describe("memoizeOnce", () => {
  it("should load once and hand back the same promise", async () => {
    const store = newStore();
    const load = vi.fn().mockResolvedValue({ id: "one" });

    const first = memoizeOnce(store, "workspace", ["user", null], load);
    const second = memoizeOnce(store, "workspace", ["user", null], load);

    expect(load).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
    await expect(first).resolves.toEqual({ id: "one" });
  });

  it("should keep different key parts apart", async () => {
    const store = newStore();
    const load = vi.fn().mockResolvedValue({ id: "one" });

    await Promise.all([
      memoizeOnce(store, "workspace", ["user-a", null], load),
      memoizeOnce(store, "workspace", ["user-b", null], load),
      memoizeOnce(store, "workspace", ["user-a", true], load),
    ]);

    expect(load).toHaveBeenCalledTimes(3);
  });

  it("should keep scopes apart inside one store", async () => {
    const store = newStore();
    const load = vi.fn().mockResolvedValue(null);

    await memoizeOnce(store, "workspace", ["same"], load);
    await memoizeOnce(store, "entitlement", ["same"], load);

    expect(load).toHaveBeenCalledTimes(2);
  });

  it("should not treat null and undefined as the same key part", async () => {
    const store = newStore();
    const load = vi.fn().mockResolvedValue(null);

    await memoizeOnce(store, "workspace", [null], load);
    await memoizeOnce(store, "workspace", [undefined], load);

    expect(load).toHaveBeenCalledTimes(2);
  });

  it("should not let a separator inside a value forge another key", async () => {
    const store = newStore();
    const load = vi.fn().mockResolvedValue(null);

    await memoizeOnce(store, "workspace", ["a\u0000b"], load);
    await memoizeOnce(store, "workspace", ["a", "b"], load);

    expect(load).toHaveBeenCalledTimes(2);
  });

  it("should memoize a rejected load instead of retrying it", async () => {
    const store = newStore();
    const load = vi.fn().mockRejectedValue(new Error("boom"));

    const first = memoizeOnce(store, "workspace", ["user"], load);
    const second = memoizeOnce(store, "workspace", ["user"], load);

    await expect(first).rejects.toThrow("boom");
    await expect(second).rejects.toThrow("boom");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("should load every time when there is no request store", async () => {
    const load = vi.fn().mockResolvedValue(null);

    await memoizeOnce(undefined, "workspace", ["user"], load);
    await memoizeOnce(undefined, "workspace", ["user"], load);

    expect(load).toHaveBeenCalledTimes(2);
  });
});
