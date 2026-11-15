import { ApiKeySchema } from "@doxynix/shared";
import { describe, expect, it, vi } from "vitest";

import type { DbClient } from "@/server/core/db";
import { apiKeyService } from "@/server/modules/api-keys/api-key.service";

const KEY_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";
const WORKSPACE_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a70";
const USER_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d";

function createApiKeyDbMock(rows: unknown[] = []) {
  const create = vi.fn().mockResolvedValue({ id: "replacement-id" });
  const findFirst = vi.fn().mockResolvedValue(rows[0] ?? null);
  const findMany = vi.fn().mockResolvedValue(rows);
  const update = vi.fn().mockResolvedValue({});
  const updateMany = vi.fn().mockResolvedValue({ count: 1 });

  const db = {
    apiKey: { create, findFirst, findMany, update, updateMany },
  } as unknown as DbClient;

  return { create, db, findFirst, findMany, update, updateMany };
}

function makeApiKeyRow(overrides?: Record<string, unknown>) {
  return {
    createdAt: new Date("2025-03-01T10:00:00Z"),
    description: "CI token",
    expiresAt: null,
    id: KEY_ID,
    lastUsed: null,
    name: "ci",
    prefix: "dxnx_abcdefg",
    revoked: false,
    revokedAfter: null,
    scopes: ["FULL"],
    updatedAt: new Date("2025-03-01T10:00:00Z"),
    ...overrides,
  };
}

const SELECTED_COLUMNS = [
  "createdAt",
  "description",
  "expiresAt",
  "id",
  "lastUsed",
  "name",
  "prefix",
  "revoked",
  "revokedAfter",
  "scopes",
  "updatedAt",
];

describe("apiKeyService.list", () => {
  const PAGE = { limit: 2 };

  it("reads one probe row past the page in the newest-first order", async () => {
    const { db, findMany } = createApiKeyDbMock([
      makeApiKeyRow({ id: "key-1" }),
      makeApiKeyRow({ id: "key-2" }),
      makeApiKeyRow({ id: "probe" }),
    ]);

    const result = await apiKeyService.list(db, WORKSPACE_ID, PAGE);

    expect(result.items.map((key) => key.id)).toStrictEqual(["key-1", "key-2"]);
    expect(result.meta).toStrictEqual({ hasNextPage: true, nextCursor: "probe" });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: undefined,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 3,
        where: { workspaceId: WORKSPACE_ID },
      }),
    );
  });

  it("keysets past the cursor id", async () => {
    const { db, findMany } = createApiKeyDbMock([makeApiKeyRow({ id: "key-3" })]);

    await apiKeyService.list(db, WORKSPACE_ID, { cursor: KEY_ID, limit: 2 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: KEY_ID }, take: 3 }),
    );
  });

  it("reports the last page without a cursor when the probe row is missing", async () => {
    const { db } = createApiKeyDbMock([makeApiKeyRow({ id: "key-1" })]);

    const result = await apiKeyService.list(db, WORKSPACE_ID, PAGE);

    expect(result.meta).toStrictEqual({ hasNextPage: false, nextCursor: undefined });
  });

  it("should not apply the redundant revoked OR clause", async () => {
    const { db, findMany } = createApiKeyDbMock();

    await apiKeyService.list(db, WORKSPACE_ID, PAGE);

    expect(findMany).toHaveBeenCalledTimes(1);
    const args = findMany.mock.calls[0]?.[0] as Record<string, unknown>;
    // The owner and nothing else — the redundant `revoked` OR clause must not come back, and
    // `where` must be exactly the tenant rather than a filter that could later be widened.
    expect(args.where).toStrictEqual({ workspaceId: WORKSPACE_ID });
    expect(JSON.stringify(args)).not.toContain("OR");
  });

  it("should never read the hashed key", async () => {
    const { db, findMany } = createApiKeyDbMock();

    await apiKeyService.list(db, WORKSPACE_ID, PAGE);

    const args = findMany.mock.calls[0]?.[0] as { select?: Record<string, boolean> };
    expect(Object.keys(args.select ?? {}).sort()).toStrictEqual(SELECTED_COLUMNS);
    expect(args.select).not.toHaveProperty("hashedKey");
  });

  it("should grandfather an empty scopes array as full access", async () => {
    const { db } = createApiKeyDbMock([makeApiKeyRow({ scopes: [] })]);

    const result = await apiKeyService.list(db, WORKSPACE_ID, PAGE);

    expect(result.items[0]?.scopes).toStrictEqual(["FULL"]);
  });

  it("should preserve explicitly chosen scopes", async () => {
    const { db } = createApiKeyDbMock([makeApiKeyRow({ scopes: ["MCP"] })]);

    const result = await apiKeyService.list(db, WORKSPACE_ID, PAGE);

    expect(result.items[0]?.scopes).toStrictEqual(["MCP"]);
  });

  it("should return only the allowlisted columns for every key", async () => {
    const { db } = createApiKeyDbMock([makeApiKeyRow(), makeApiKeyRow({ id: "second-id" })]);

    const result = await apiKeyService.list(db, WORKSPACE_ID, PAGE);

    for (const key of result.items) {
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

    const result = await apiKeyService.create(db, USER_ID, WORKSPACE_ID, {
      name: "ci",
      scopes: ["FULL"],
    });

    expect(result.key).toMatch(/^dxnx_/);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("should persist only the hash and the display prefix", async () => {
    const { create, db } = createApiKeyDbMock();

    const result = await apiKeyService.create(db, USER_ID, WORKSPACE_ID, {
      description: "CI token",
      name: "ci",
      scopes: ["FULL"],
    });

    const data = create.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.hashedKey).toBeTypeOf("string");
    expect(data.hashedKey).not.toBe(result.key);
    expect(data.prefix).toBe(result.key.slice(0, 11));
    expect(data).not.toHaveProperty("key");
    expect(JSON.stringify(data)).not.toContain(result.key);
  });

  it("should default new keys to full access when no scope is chosen", async () => {
    const { create, db } = createApiKeyDbMock();

    await apiKeyService.create(db, USER_ID, WORKSPACE_ID, { name: "ci", scopes: ["FULL"] });

    const data = create.mock.calls[0]?.[0]?.data as { scopes: string[] };
    expect(data.scopes).toStrictEqual(["FULL"]);
  });

  it("should persist the requested scopes verbatim", async () => {
    const { create, db } = createApiKeyDbMock();

    await apiKeyService.create(db, USER_ID, WORKSPACE_ID, { name: "mcp-only", scopes: ["MCP"] });

    const data = create.mock.calls[0]?.[0]?.data as { scopes: string[] };
    expect(data.scopes).toStrictEqual(["MCP"]);
  });
});

describe("apiKeyService mutations", () => {
  it("should return no key material from touch", async () => {
    const { db, updateMany } = createApiKeyDbMock();
    updateMany.mockResolvedValue({ count: 1 });

    const result = await apiKeyService.touch(db, KEY_ID, USER_ID, WORKSPACE_ID);

    expect(result).toStrictEqual({ success: true });
    expect(updateMany).toHaveBeenCalledWith({
      data: { lastUsed: expect.any(Date) },
      where: { id: KEY_ID, workspaceId: WORKSPACE_ID },
    });
  });

  it("should return no key material from update", async () => {
    const { db, updateMany } = createApiKeyDbMock();
    updateMany.mockResolvedValue({ count: 1 });

    const result = await apiKeyService.update(
      db,
      { description: "new", id: KEY_ID, name: "ci" },
      USER_ID,
      WORKSPACE_ID,
    );

    expect(result).toStrictEqual({ success: true });
    const args = updateMany.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(Object.keys(args.data).sort()).toStrictEqual(["description", "name"]);
    expect(args.data).not.toHaveProperty("hashedKey");
  });

  it("should clear the expiry when null is sent explicitly", async () => {
    const { db, updateMany } = createApiKeyDbMock();
    updateMany.mockResolvedValue({ count: 1 });

    await apiKeyService.update(
      db,
      { expiresAt: null, id: KEY_ID, name: "ci" },
      USER_ID,
      WORKSPACE_ID,
    );

    const args = updateMany.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(args.data.expiresAt).toBeNull();
  });

  it("should leave the expiry untouched when the field is absent", async () => {
    const { db, updateMany } = createApiKeyDbMock();
    updateMany.mockResolvedValue({ count: 1 });

    await apiKeyService.update(db, { id: KEY_ID, name: "ci" }, USER_ID, WORKSPACE_ID);

    const args = updateMany.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(args.data).not.toHaveProperty("expiresAt");
  });

  it("should issue a replacement and only start the old key's grace window on rotate", async () => {
    const { create, db, findFirst, update } = createApiKeyDbMock([makeApiKeyRow()]);

    const result = await apiKeyService.rotate(db, KEY_ID, USER_ID, WORKSPACE_ID);

    expect(result.key).toMatch(/^dxnx_/);
    expect(result.gracePeriodDays).toBe(7);
    expect(findFirst).toHaveBeenCalledWith({ where: { id: KEY_ID, workspaceId: WORKSPACE_ID } });

    const created = create.mock.calls[0]?.[0]?.data as { scopes: string[] };
    expect(created.scopes).toStrictEqual(["FULL"]);

    const retired = update.mock.calls[0]?.[0] as { data: { revokedAfter: Date } };
    expect(retired.data.revokedAfter.getTime()).toBeGreaterThan(Date.now());
  });

  it("should create the replacement and retire the old key in one transaction", async () => {
    const txCreate = vi.fn().mockResolvedValue({ id: "replacement-id" });
    const txFindFirst = vi.fn().mockResolvedValue(makeApiKeyRow());
    const txUpdate = vi.fn().mockResolvedValue({});
    const tx = { apiKey: { create: txCreate, findFirst: txFindFirst, update: txUpdate } };

    const rootCreate = vi.fn();
    const rootUpdate = vi.fn();
    const $transaction = vi.fn(async (fn: (client: unknown) => Promise<unknown>) => fn(tx));

    const db = {
      $transaction,
      apiKey: { create: rootCreate, findFirst: vi.fn(), update: rootUpdate },
    } as unknown as DbClient;

    await apiKeyService.rotate(db, KEY_ID, USER_ID, WORKSPACE_ID);

    expect($transaction).toHaveBeenCalledOnce();
    expect(txFindFirst).toHaveBeenCalledWith({ where: { id: KEY_ID, workspaceId: WORKSPACE_ID } });
    expect(txCreate).toHaveBeenCalledOnce();
    expect(txUpdate).toHaveBeenCalledWith({
      data: expect.objectContaining({ revoked: true }),
      where: { id: KEY_ID, workspaceId: WORKSPACE_ID },
    });
    expect(rootCreate).not.toHaveBeenCalled();
    expect(rootUpdate).not.toHaveBeenCalled();
  });

  it("should refuse to rotate an already retired key", async () => {
    const { db, findFirst } = createApiKeyDbMock([]);
    findFirst.mockResolvedValue(makeApiKeyRow({ revoked: true, revokedAfter: null }));

    await expect(apiKeyService.rotate(db, KEY_ID, USER_ID, WORKSPACE_ID)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("should clear any grace window when revoking outright", async () => {
    const { db, update } = createApiKeyDbMock();

    await apiKeyService.revoke(db, KEY_ID, USER_ID, WORKSPACE_ID);

    const retired = update.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(retired.data).toStrictEqual({ revoked: true, revokedAfter: null });
  });

  it("should return no key material from revoke", async () => {
    const { db } = createApiKeyDbMock();

    const result = await apiKeyService.revoke(db, KEY_ID, USER_ID, WORKSPACE_ID);

    expect(result).toStrictEqual({ success: true });
    expect(JSON.stringify(result)).not.toContain("dxnx_");
  });
});
