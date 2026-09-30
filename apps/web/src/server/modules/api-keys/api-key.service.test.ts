import { ApiKeySchema } from "@doxynix/shared";
import { describe, expect, it, vi } from "vitest";

import type { DbClient } from "@/server/core/db";
import { apiKeyService } from "@/server/modules/api-keys/api-key.service";

const KEY_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";
const USER_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d";

function createApiKeyDbMock(rows: unknown[] = []) {
  const create = vi.fn().mockResolvedValue({});
  const findMany = vi.fn().mockResolvedValue(rows);
  const update = vi.fn().mockResolvedValue({});
  const updateMany = vi.fn().mockResolvedValue({ count: 1 });

  const db = {
    apiKey: { create, findMany, update, updateMany },
  } as unknown as DbClient;

  return { create, db, findMany, update, updateMany };
}

function makeApiKeyRow(overrides?: Record<string, unknown>) {
  return {
    createdAt: new Date("2025-03-01T10:00:00Z"),
    description: "CI token",
    id: KEY_ID,
    lastUsed: null,
    name: "ci",
    prefix: "dxnx_abcdefg",
    revoked: false,
    updatedAt: new Date("2025-03-01T10:00:00Z"),
    ...overrides,
  };
}

const SELECTED_COLUMNS = [
  "createdAt",
  "description",
  "id",
  "lastUsed",
  "name",
  "prefix",
  "revoked",
  "updatedAt",
];

describe("apiKeyService.list", () => {
  it("should partition revoked and non-revoked keys without dropping either", async () => {
    const active = makeApiKeyRow({ id: "active-id", revoked: false });
    const archived = makeApiKeyRow({ id: "archived-id", revoked: true });
    const { db } = createApiKeyDbMock([active, archived]);

    const result = await apiKeyService.list(db);

    expect(result.active.map((key) => key.id)).toStrictEqual(["active-id"]);
    expect(result.archived.map((key) => key.id)).toStrictEqual(["archived-id"]);
  });

  it("should not apply the redundant revoked OR clause", async () => {
    const { db, findMany } = createApiKeyDbMock();

    await apiKeyService.list(db);

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" } }),
    );
    const args = findMany.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(args).not.toHaveProperty("where");
    expect(JSON.stringify(args)).not.toContain("OR");
  });

  it("should never read the hashed key", async () => {
    const { db, findMany } = createApiKeyDbMock();

    await apiKeyService.list(db);

    const args = findMany.mock.calls[0]?.[0] as { select?: Record<string, boolean> };
    expect(Object.keys(args.select ?? {}).sort()).toStrictEqual(SELECTED_COLUMNS);
    expect(args.select).not.toHaveProperty("hashedKey");
  });

  it("should return only the allowlisted columns for every key", async () => {
    const { db } = createApiKeyDbMock([
      makeApiKeyRow(),
      makeApiKeyRow({ id: "revoked-id", revoked: true }),
    ]);

    const result = await apiKeyService.list(db);

    for (const key of [...result.active, ...result.archived]) {
      expect(Object.keys(key).sort()).toStrictEqual(SELECTED_COLUMNS);
      expect(key).not.toHaveProperty("hashedKey");
      expect(key).not.toHaveProperty("userId");
      expect(key).not.toHaveProperty("key");
    }
  });

  it("should satisfy ApiKeySchema so the router output cannot widen the payload", () => {
    const parsed = ApiKeySchema.parse({
      ...makeApiKeyRow(),
      hashedKey: "leaked-hash",
      key: "dxnx_plaintext_key",
    });

    expect(Object.keys(parsed).sort()).toStrictEqual(Object.keys(ApiKeySchema.shape).sort());
    expect(JSON.stringify(parsed)).not.toContain("leaked-hash");
    expect(JSON.stringify(parsed)).not.toContain("dxnx_plaintext_key");
  });
});

describe("apiKeyService.create", () => {
  it("should return the plaintext key exactly once", async () => {
    const { create, db } = createApiKeyDbMock();

    const result = await apiKeyService.create(db, USER_ID, { name: "ci" });

    expect(result.key).toMatch(/^dxnx_/);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("should persist only the hash and the display prefix", async () => {
    const { create, db } = createApiKeyDbMock();

    const result = await apiKeyService.create(db, USER_ID, { description: "CI token", name: "ci" });

    const data = create.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.hashedKey).toBeTypeOf("string");
    expect(data.hashedKey).not.toBe(result.key);
    expect(data.prefix).toBe(result.key.slice(0, 11));
    expect(data).not.toHaveProperty("key");
    expect(JSON.stringify(data)).not.toContain(result.key);
  });
});

describe("apiKeyService mutations", () => {
  it("should return no key material from touch", async () => {
    const { db, updateMany } = createApiKeyDbMock();
    updateMany.mockResolvedValue({ count: 1 });

    const result = await apiKeyService.touch(db, KEY_ID);

    expect(result).toStrictEqual({ success: true });
    expect(updateMany).toHaveBeenCalledWith({
      data: { lastUsed: expect.any(Date) },
      where: { id: KEY_ID },
    });
  });

  it("should return no key material from update", async () => {
    const { db, updateMany } = createApiKeyDbMock();
    updateMany.mockResolvedValue({ count: 1 });

    const result = await apiKeyService.update(db, { description: "new", id: KEY_ID, name: "ci" });

    expect(result).toStrictEqual({ success: true });
    const args = updateMany.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(Object.keys(args.data).sort()).toStrictEqual(["description", "name"]);
    expect(args.data).not.toHaveProperty("hashedKey");
  });

  it("should return no key material from revoke", async () => {
    const { db } = createApiKeyDbMock();

    const result = await apiKeyService.revoke(db, KEY_ID);

    expect(result).toStrictEqual({ success: true });
    expect(JSON.stringify(result)).not.toContain("dxnx_");
  });
});
