import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  appLogger: { debug: vi.fn(), error: vi.fn(), flush: vi.fn(), info: vi.fn(), warn: vi.fn() },
  enhance: vi.fn((db: unknown) => db),
}));

vi.mock("@/server/core/app-logger", () => ({ appLogger: mocks.appLogger }));
vi.mock("@zenstackhq/runtime", () => ({ enhance: mocks.enhance }));
vi.mock("@/server/utils/request-context", () => ({
  buildRequestStore: vi.fn((o: unknown) => ({ ...(o as object), requestId: "req-1" })),
  requestContext: {
    getStore: vi.fn(() => null),
    run: vi.fn((_s: unknown, fn: () => unknown) => fn()),
  },
  resolveRequestId: vi.fn(() => "req-1"),
}));
vi.mock("@/shared/config/env.flags", () => ({ IS_PROD: false }));

import { createCallerFactory } from "@/server/core/trpc/init";

import { agentChatRouter } from "./agent.router";

const VALID_UUID = "7f9c0c52-6f0d-4f6b-9c5e-3d4e5f6a7b8c";

// enhance() is mocked as identity, so the withZenStack middleware sets
// ctx.db = ctx.prisma. The db mocks therefore live under `prisma`.
function makeCtx(overrides: Record<string, unknown> = {}) {
  return {
    db: {},
    prisma: {
      chatMessage: { findMany: vi.fn() },
      chatSession: { create: vi.fn(), findMany: vi.fn() },
      repo: { findFirst: vi.fn(), findUnique: vi.fn() },
    },
    redis: null,
    req: {},
    requestInfo: {},
    session: { user: { id: "11" } },
    ...overrides,
  };
}

const createCaller = createCallerFactory(agentChatRouter);
function makeCaller(overrides?: Record<string, unknown>) {
  const ctx = makeCtx(overrides);
  return { caller: createCaller(ctx as never), db: ctx.prisma as any };
}

describe("agentChatRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createSession", () => {
    it("creates session without repoId", async () => {
      const { caller, db } = makeCaller();
      db.chatSession.create.mockResolvedValue({ id: "s1" });

      await caller.createSession({});

      expect(db.chatSession.create).toHaveBeenCalledWith({
        data: { repoId: undefined, title: "New Chat", userId: 11 },
      });
    });

    it("creates session with repoId when repo found", async () => {
      const { caller, db } = makeCaller();
      db.repo.findFirst.mockResolvedValue({ id: 7 });
      db.chatSession.create.mockResolvedValue({ id: "s2" });

      await caller.createSession({ repoId: VALID_UUID, title: "My Chat" });

      expect(db.repo.findFirst).toHaveBeenCalledWith({
        select: { id: true },
        where: { publicId: VALID_UUID, userId: 11 },
      });
      expect(db.chatSession.create).toHaveBeenCalledWith({
        data: { repoId: 7, title: "My Chat", userId: 11 },
      });
    });

    it("rejects NOT_FOUND when repo does not exist", async () => {
      const { caller, db } = makeCaller();
      db.repo.findFirst.mockResolvedValue(null);

      await expect(caller.createSession({ repoId: VALID_UUID })).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: expect.stringContaining("not found"),
      });

      expect(db.chatSession.create).not.toHaveBeenCalled();
    });

    it("defaults title to New Chat", async () => {
      const { caller, db } = makeCaller();
      db.chatSession.create.mockResolvedValue({ id: "s3" });

      await caller.createSession({});

      expect(db.chatSession.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ title: "New Chat" }) }),
      );
    });

    it("rejects BAD_REQUEST for invalid repoId", async () => {
      const { caller, db } = makeCaller();

      await expect(caller.createSession({ repoId: "nope" })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });

      expect(db.chatSession.create).not.toHaveBeenCalled();
    });
  });

  describe("getSessionHistory", () => {
    it("maps raw messages with parsed parts", async () => {
      const { caller, db } = makeCaller();
      const now = new Date();
      db.chatMessage.findMany.mockResolvedValue([
        { createdAt: now, id: 1, parts: '{"type":"text","text":"hi"}', role: "user" },
      ]);

      const result = await caller.getSessionHistory({ sessionId: VALID_UUID });

      expect(db.chatMessage.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: "asc" },
        where: { sessionId: VALID_UUID },
      });
      expect(result).toEqual([
        { createdAt: now, id: 1, parts: { text: "hi", type: "text" }, role: "user" },
      ]);
    });

    it("rejects when parts contains invalid JSON", async () => {
      const { caller, db } = makeCaller();
      db.chatMessage.findMany.mockResolvedValue([
        { createdAt: new Date(), id: 1, parts: "{bad", role: "user" },
      ]);

      await expect(caller.getSessionHistory({ sessionId: VALID_UUID })).rejects.toMatchObject({
        cause: expect.any(SyntaxError),
      });
    });
  });

  describe("listSessions", () => {
    it("lists sessions without currentRepo filter", async () => {
      const { caller, db } = makeCaller();
      db.chatSession.findMany.mockResolvedValue([]);

      const result = await caller.listSessions();

      expect(db.repo.findUnique).not.toHaveBeenCalled();
      expect(db.chatSession.findMany).toHaveBeenCalledWith({
        include: { repo: { select: { name: true, owner: true } } },
        orderBy: { updatedAt: "desc" },
        where: { repoId: null, userId: 11 },
      });
      expect(result).toEqual([]);
    });

    it("filters by currentRepo when repo found", async () => {
      const { caller, db } = makeCaller();
      db.repo.findUnique.mockResolvedValue({ id: 3 });
      db.chatSession.findMany.mockResolvedValue([]);

      await caller.listSessions({ currentRepo: { name: "r", owner: "o" } });

      expect(db.repo.findUnique).toHaveBeenCalledWith({
        select: { id: true },
        where: { owner_name_userId: { name: "r", owner: "o", userId: 11 } },
      });
      expect(db.chatSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { repoId: 3, userId: 11 } }),
      );
    });

    it("falls back to null repoId when currentRepo not found", async () => {
      const { caller, db } = makeCaller();
      db.repo.findUnique.mockResolvedValue(null);
      db.chatSession.findMany.mockResolvedValue([]);

      await caller.listSessions({ currentRepo: { name: "r", owner: "o" } });

      expect(db.chatSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { repoId: null, userId: 11 } }),
      );
    });
  });

  it("rejects with UNAUTHORIZED when session is null", async () => {
    const { caller } = makeCaller({ session: null });

    await expect(caller.createSession({})).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: expect.stringContaining("not logged in"),
    });
  });
});
