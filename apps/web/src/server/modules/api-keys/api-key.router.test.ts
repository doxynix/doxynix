import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  appLogger: { debug: vi.fn(), error: vi.fn(), flush: vi.fn(), info: vi.fn(), warn: vi.fn() },
  enhance: vi.fn((db: unknown) => db),
  extractPayloadFromKey: vi.fn(),
  generateApiKey: vi.fn(() => "dxnk_testApIkeyPayloadPart_rest"),
  getApiKeyHash: vi.fn((p: string) => `hash:${p}`),
}));

const MockPrismaClientKnownRequestError = vi.hoisted(
  () =>
    class PrismaClientKnownRequestError extends Error {
      public code: string;
      public meta: { target?: string | string[] } | undefined;

      public constructor(
        message: string,
        options: { code: string; clientVersion: string; meta?: { target?: string | string[] } },
      ) {
        super(message);
        this.code = options.code;
        this.meta = options.meta;
      }
    },
);

vi.mock("@/server/core/app-logger", () => ({ appLogger: mocks.appLogger }));
vi.mock("@zenstackhq/runtime", () => ({ enhance: mocks.enhance }));
vi.mock("@prisma/client", () => ({
  Prisma: { PrismaClientKnownRequestError: MockPrismaClientKnownRequestError },
}));
vi.mock("@/server/utils/request-context", () => ({
  buildRequestStore: vi.fn((o: unknown) => ({ ...(o as object), requestId: "req-1" })),
  requestContext: {
    getStore: vi.fn(() => null),
    run: vi.fn((_s: unknown, fn: () => unknown) => fn()),
  },
  resolveRequestId: vi.fn(() => "req-1"),
}));
vi.mock("@/shared/config/env.flags", () => ({ IS_PROD: false }));
vi.mock("@/server/utils/hash", () => ({
  extractPayloadFromKey: mocks.extractPayloadFromKey,
  generateApiKey: mocks.generateApiKey,
  getApiKeyHash: mocks.getApiKeyHash,
}));

import { createCallerFactory } from "@/server/core/trpc/init";

import { apiKeyRouter } from "./api-key.router";

const createCaller = createCallerFactory(apiKeyRouter);

function makeCtx(overrides: Record<string, unknown> = {}) {
  // The `withZenStack` middleware replaces `ctx.db` with `enhance(ctx.prisma)`,
  // and `enhance` is mocked to return its first argument, so the API-key mock
  // must also be reachable through `prisma`.
  const db = {
    apiKey: { create: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  };
  return {
    db,
    prisma: db,
    redis: null,
    req: {},
    requestInfo: {},
    session: { user: { id: "7" } },
    ...overrides,
  };
}

function makeCaller(overrides: Record<string, unknown> = {}) {
  const ctx = makeCtx(overrides);
  return { caller: createCaller(ctx as never), db: ctx.db };
}

function prismaError(code: string, meta: { target?: string | string[] } = {}) {
  return new Prisma.PrismaClientKnownRequestError(code, {
    clientVersion: "6.19.3",
    code,
    meta,
  });
}

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

const rowA = {
  createdAt: new Date("2024-01-01T00:00:00Z"),
  description: "manual testing",
  id: UUID_A,
  lastUsed: null,
  name: "Manual Key",
  prefix: "dxnk_manualA",
  revoked: false,
  updatedAt: new Date("2024-01-02T00:00:00Z"),
};

const rowB = {
  ...rowA,
  description: null,
  id: UUID_B,
  name: "Revoked Key",
  prefix: "dxnk_revokd",
  revoked: true,
};

describe("apiKeyRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.extractPayloadFromKey.mockReturnValue("payload-part");
  });

  describe("create", () => {
    it("creates an API key and returns the full key once", async () => {
      const { caller, db } = makeCaller();

      const result = await caller.create({ description: "desc", name: "My Key" });

      expect(result).toEqual({
        key: "dxnk_testApIkeyPayloadPart_rest",
        message: "API Key created",
      });
      expect(db.apiKey.create).toHaveBeenCalledWith({
        data: {
          description: "desc",
          hashedKey: "hash:payload-part",
          name: "My Key",
          prefix: "dxnk_testAp",
          userId: 7,
        },
      });
    });

    it("rejects INTERNAL_SERVER_ERROR when payload extraction fails", async () => {
      mocks.extractPayloadFromKey.mockReturnValue(null);
      const { caller } = makeCaller();

      await expect(caller.create({ name: "My Key" })).rejects.toMatchObject({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to process and validate generated API key integrity.",
      });
    });

    it("rejects CONFLICT when a duplicate name exists", async () => {
      const { caller, db } = makeCaller();
      db.apiKey.create.mockRejectedValue(prismaError("P2002", { target: ["name"] }));

      await expect(caller.create({ description: "desc", name: "My Key" })).rejects.toMatchObject({
        code: "CONFLICT",
        message: "API Key with this name already exists",
      });
    });

    it("rejects BAD_REQUEST when the name is empty", async () => {
      const { caller } = makeCaller();

      await expect(caller.create({ name: "" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });
  });

  describe("list", () => {
    it("splits keys into active and archived buckets", async () => {
      const { caller, db } = makeCaller();
      db.apiKey.findMany.mockResolvedValue([rowA, rowB]);

      const result = await caller.list();

      expect(result).toEqual({ active: [rowA], archived: [rowB] });
      expect(db.apiKey.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: "desc" },
        where: { OR: [{ revoked: true }, { revoked: false }] },
      });
    });
  });

  describe("revoke", () => {
    it("revokes an existing key", async () => {
      const { caller, db } = makeCaller();
      db.apiKey.update.mockResolvedValue(rowA);

      const result = await caller.revoke({ id: UUID_A });

      expect(result).toEqual({ message: "API Key revoked", success: true });
      expect(db.apiKey.update).toHaveBeenCalledWith({
        data: { revoked: true },
        where: { id: UUID_A },
      });
    });

    it("rejects NOT_FOUND when the key does not exist", async () => {
      const { caller, db } = makeCaller();
      db.apiKey.update.mockRejectedValue(prismaError("P2025"));

      await expect(caller.revoke({ id: UUID_A })).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "Key not found",
      });
    });

    it("rejects BAD_REQUEST for a malformed id", async () => {
      const { caller } = makeCaller();

      await expect(caller.revoke({ id: "not-a-uuid" })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    });
  });

  describe("touch", () => {
    it("touches the key when it exists", async () => {
      const { caller, db } = makeCaller();
      db.apiKey.updateMany.mockResolvedValue({ count: 2 });

      const result = await caller.touch({ id: UUID_A });

      expect(result).toEqual({ success: true });
      expect(db.apiKey.updateMany).toHaveBeenCalledWith({
        data: { lastUsed: expect.any(Date) },
        where: { id: UUID_A },
      });
    });

    it("rejects NOT_FOUND when no rows are updated", async () => {
      const { caller, db } = makeCaller();
      db.apiKey.updateMany.mockResolvedValue({ count: 0 });

      await expect(caller.touch({ id: UUID_A })).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: expect.stringMatching(/access denied/),
      });
    });

    it("rejects BAD_REQUEST for a malformed id", async () => {
      const { caller } = makeCaller();

      await expect(caller.touch({ id: "not-a-uuid" })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    });
  });

  describe("update", () => {
    it("updates an existing key", async () => {
      const { caller, db } = makeCaller();
      db.apiKey.updateMany.mockResolvedValue({ count: 1 });

      const result = await caller.update({ description: "new desc", id: UUID_A, name: "Renamed" });

      expect(result).toEqual({ message: "API Key data updated", success: true });
      expect(db.apiKey.updateMany).toHaveBeenCalledWith({
        data: { description: "new desc", name: "Renamed" },
        where: { id: UUID_A },
      });
    });

    it("rejects NOT_FOUND when no rows are updated", async () => {
      const { caller, db } = makeCaller();
      db.apiKey.updateMany.mockResolvedValue({ count: 0 });

      await expect(caller.update({ id: UUID_A, name: "Renamed" })).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "Key not found or access denied",
      });
    });

    it("rejects CONFLICT when the name is already taken", async () => {
      const { caller, db } = makeCaller();
      db.apiKey.updateMany.mockRejectedValue(prismaError("P2002", { target: ["name"] }));

      await expect(caller.update({ id: UUID_A, name: "Taken" })).rejects.toMatchObject({
        code: "CONFLICT",
        message: "Name already taken",
      });
    });
  });

  describe("authorization", () => {
    it("rejects UNAUTHORIZED when there is no session", async () => {
      const { caller } = makeCaller({ session: null });

      await expect(caller.create({ name: "My Key" })).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        message: "You are not logged in",
      });
    });
  });
});
