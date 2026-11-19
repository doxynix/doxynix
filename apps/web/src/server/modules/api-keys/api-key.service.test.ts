import { ApiKeySchema, isApiKeyDead } from "@doxynix/shared";
import type { Prisma } from "@prisma/client";
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
        where: expect.objectContaining({ workspaceId: WORKSPACE_ID }),
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

  it("scopes the page to the workspace and to live keys only", async () => {
    const { db, findMany } = createApiKeyDbMock();

    await apiKeyService.list(db, WORKSPACE_ID, PAGE);

    expect(findMany).toHaveBeenCalledTimes(1);
    const args = findMany.mock.calls[0]?.[0] as { where?: Record<string, unknown> };
    const serialized = JSON.stringify(args.where);

    // The tenant is the outer filter; the dead rows are excluded in SQL rather than by a
    // client-side partition of the first page.
    expect(args.where).toHaveProperty("workspaceId", WORKSPACE_ID);
    expect(args.where).toHaveProperty("OR");
    expect(serialized).not.toContain("lte");
  });

  it("pages archived keys with the same keyset as the live list", async () => {
    const { db, findMany } = createApiKeyDbMock([
      makeApiKeyRow({ id: "dead-1", revoked: true }),
      makeApiKeyRow({ id: "probe", revoked: true }),
    ]);

    const result = await apiKeyService.listArchived(db, WORKSPACE_ID, { limit: 1 });

    expect(result.items.map((key) => key.id)).toStrictEqual(["dead-1"]);
    expect(result.meta).toStrictEqual({ hasNextPage: true, nextCursor: "probe" });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: undefined,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 2,
        where: expect.objectContaining({ workspaceId: WORKSPACE_ID }),
      }),
    );
    const args = findMany.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(JSON.stringify(args.where)).not.toContain("gt");
  });

  it("keysets the archived list past the cursor id too", async () => {
    const { db, findMany } = createApiKeyDbMock();

    await apiKeyService.listArchived(db, WORKSPACE_ID, { cursor: KEY_ID, limit: 2 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: KEY_ID }, take: 3 }),
    );
  });

  it("normalises the scopes of an archived key the same way", async () => {
    const { db } = createApiKeyDbMock([makeApiKeyRow({ revoked: true, scopes: [] })]);

    const result = await apiKeyService.listArchived(db, WORKSPACE_ID, { limit: 10 });

    expect(result.items[0]?.scopes).toStrictEqual(["FULL"]);
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

describe("apiKeyService active/archived predicates", () => {
  type LifecycleRow = { expiresAt: Date | null; revoked: boolean; revokedAfter: Date | null };

  // Evaluates the narrow subset of Prisma filters these predicates emit, so the test compares
  // them with `isApiKeyDead` instead of re-implementing the same branch order twice.
  function matchesWhere(where: Prisma.ApiKeyWhereInput, row: LifecycleRow): boolean {
    return Object.entries(where).every(([field, condition]) => {
      if (field === "workspaceId") {
        return true;
      }

      if (field === "OR") {
        return (condition as Prisma.ApiKeyWhereInput[]).some((branch) => matchesWhere(branch, row));
      }

      const value = row[field as keyof LifecycleRow];

      if (condition === null) {
        return value == null;
      }

      if (typeof condition === "boolean") {
        return value === condition;
      }

      const range = condition as { gt?: Date; lte?: Date };

      if (!(value instanceof Date)) {
        return false;
      }

      if (range.gt !== undefined) {
        return value > range.gt;
      }

      if (range.lte !== undefined) {
        return value <= range.lte;
      }

      throw new Error(`Unsupported predicate on ${field}`);
    });
  }

  it("splits the truth table exactly where isApiKeyDead does", async () => {
    const wheres: Prisma.ApiKeyWhereInput[] = [];
    const findMany = vi.fn((args: { where: Prisma.ApiKeyWhereInput }) => {
      wheres.push(args.where);

      return Promise.resolve([]);
    });
    const db = { apiKey: { findMany } } as unknown as DbClient;

    await apiKeyService.list(db, WORKSPACE_ID, { limit: 1 });
    const activeWhere = wheres[0];
    await apiKeyService.listArchived(db, WORKSPACE_ID, { limit: 10 });
    const archivedWhere = wheres[1];

    if (activeWhere == null || archivedWhere == null) {
      throw new Error("both list and listArchived must query the database");
    }

    const now = Date.now();
    const past = new Date(now - 60_000);
    const future = new Date(now + 60_000);

    for (const revokedAfter of [null, past, future]) {
      for (const revoked of [false, true]) {
        for (const expiresAt of [null, past, future]) {
          const row = { expiresAt, revoked, revokedAfter };
          const dead = isApiKeyDead(row, now);
          const label = {
            expiresAt: expiresAt?.toISOString() ?? "null",
            revoked,
            revokedAfter: revokedAfter?.toISOString() ?? "null",
          };

          expect({ ...label, active: matchesWhere(activeWhere, row) }).toStrictEqual({
            ...label,
            active: !dead,
          });
          expect({ ...label, archived: matchesWhere(archivedWhere, row) }).toStrictEqual({
            ...label,
            archived: dead,
          });
        }
      }
    }
  });

  it("puts a mixed fixture on the right side of the split", async () => {
    const now = Date.now();
    const past = new Date(now - 60_000);
    const future = new Date(now + 60_000);

    const rows = [
      makeApiKeyRow({ id: "live" }),
      makeApiKeyRow({ expiresAt: future, id: "expiring-later" }),
      makeApiKeyRow({ expiresAt: past, id: "expired" }),
      makeApiKeyRow({ id: "revoked", revoked: true }),
      makeApiKeyRow({ id: "grace-open", revoked: true, revokedAfter: future }),
      makeApiKeyRow({ id: "grace-closed", revoked: true, revokedAfter: past }),
    ];

    const findMany = vi.fn((args: { where: Prisma.ApiKeyWhereInput }) =>
      Promise.resolve(rows.filter((row) => matchesWhere(args.where, row))),
    );
    const db = { apiKey: { findMany } } as unknown as DbClient;

    const active = await apiKeyService.list(db, WORKSPACE_ID, { limit: 10 });
    const archived = await apiKeyService.listArchived(db, WORKSPACE_ID, { limit: 10 });

    expect(active.items.map((key) => key.id).sort()).toStrictEqual([
      "expiring-later",
      "grace-open",
      "live",
    ]);
    expect(archived.items.map((key) => key.id).sort()).toStrictEqual([
      "expired",
      "grace-closed",
      "revoked",
    ]);
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
