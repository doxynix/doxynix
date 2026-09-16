import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  appLogger: { debug: vi.fn(), error: vi.fn(), flush: vi.fn(), info: vi.fn(), warn: vi.fn() },
  buildWhereClause: vi.fn(() => ({})),
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
vi.mock("./notifications.service", () => ({
  notificationsService: { buildWhereClause: mocks.buildWhereClause },
}));

import { Prisma } from "@prisma/client";

import { createCallerFactory } from "@/server/core/trpc/init";

import { notificationRouter } from "./notifications.router";

const createCaller = createCallerFactory(notificationRouter);

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

function makeCtx(overrides: Record<string, unknown> = {}) {
  const notification = {
    count: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    findMany: vi.fn(),
    groupBy: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  };
  // The withZenStack middleware replaces ctx.db with enhance(ctx.prisma); the mocked
  // enhance is an identity, so the router hits `prisma.notification`. Share the mocks
  // object so assertions on `db` (returned by makeCaller) observe the same calls.
  return {
    db: { notification },
    prisma: { notification },
    redis: null,
    req: {},
    requestInfo: {},
    session: { user: { id: "3" } },
    ...overrides,
  };
}

function makeCaller(overrides?: Record<string, unknown>) {
  const ctx = makeCtx(overrides);
  return { caller: createCaller(ctx as never), db: ctx.db as any };
}

// Must satisfy NotificationSchema (output-validated at call time): `id` derives from
// `publicId` (a uuid), `type` is a NotifyType enum value, `repo` is { name, owner }.
function makeItem(publicId: string, overrides: Record<string, unknown> = {}) {
  return {
    body: "Your analysis has finished",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    id: publicId,
    isRead: false,
    publicId,
    repo: { name: "doxynix", owner: "ivan" },
    title: "Analysis complete",
    type: "INFO",
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("notificationRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buildWhereClause.mockReturnValue({});
  });

  describe("deleteOne", () => {
    it("deletes by publicId and returns success payload", async () => {
      const { caller, db } = makeCaller();
      db.notification.delete.mockResolvedValue({ id: 1 });

      await expect(caller.deleteOne({ id: UUID_A })).resolves.toEqual({
        message: "Notification deleted",
        success: true,
      });
      expect(db.notification.delete).toHaveBeenCalledWith({ where: { publicId: UUID_A } });
    });

    it("rejects with NOT_FOUND on P2025", async () => {
      const { caller, db } = makeCaller();
      db.notification.delete.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Record to delete does not exist", {
          clientVersion: "6.0.0",
          code: "P2025",
        }),
      );

      await expect(caller.deleteOne({ id: UUID_A })).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "Notification not found",
      });
    });
  });

  describe("deleteRead", () => {
    it("deletes only read notifications with the built where clause", async () => {
      mocks.buildWhereClause.mockReturnValue({ type: "ANALYSIS_COMPLETED" });
      const { caller, db } = makeCaller();
      db.notification.deleteMany.mockResolvedValue({ count: 3 });

      await expect(caller.deleteRead({})).resolves.toEqual({
        deletedCount: 3,
        message: "Deleted 3 read notifications",
        success: true,
      });
      expect(db.notification.deleteMany).toHaveBeenCalledWith({
        where: { isRead: true, type: "ANALYSIS_COMPLETED" },
      });
    });
  });

  describe("getAll", () => {
    it("maps items to public ids and returns pagination meta", async () => {
      const { caller, db } = makeCaller();
      db.notification.findMany.mockResolvedValue([makeItem(UUID_A), makeItem(UUID_B)]);
      db.notification.count.mockResolvedValue(2);

      const result = await caller.getAll({});

      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toMatchObject({
        id: UUID_A,
        repo: { name: "doxynix", owner: "ivan" },
        title: "Analysis complete",
      });
      expect(result.items[1]!.id).toBe(UUID_B);
      expect(result.meta).toMatchObject({
        currentPage: 1,
        filteredCount: 2,
        pageSize: 10,
        totalCount: 2,
      });
      expect(db.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 10, where: {} }),
      );
      expect(db.notification.count).toHaveBeenCalledTimes(2);
    });

    it("computes skip from cursor and passes search to pagination meta", async () => {
      const { caller, db } = makeCaller();
      db.notification.findMany.mockResolvedValue([makeItem(UUID_A)]);
      db.notification.count.mockResolvedValue(25);

      const result = await caller.getAll({ cursor: 3, search: "critical" });

      expect(db.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
      expect(result.meta).toMatchObject({
        currentPage: 3,
        pageSize: 10,
        searchQuery: "critical",
        totalCount: 25,
      });
    });
  });

  describe("getStats", () => {
    it("aggregates read/unread counts from groupBy", async () => {
      const { caller, db } = makeCaller();
      db.notification.groupBy.mockResolvedValue([
        { _count: { _all: 5 }, isRead: true },
        { _count: { _all: 2 }, isRead: false },
      ]);

      await expect(caller.getStats()).resolves.toEqual({ read: 5, total: 7, unread: 2 });
    });

    it("returns zeros when no groups exist", async () => {
      const { caller, db } = makeCaller();
      db.notification.groupBy.mockResolvedValue([]);

      await expect(caller.getStats()).resolves.toEqual({ read: 0, total: 0, unread: 0 });
    });

    it("rejects with INTERNAL_SERVER_ERROR on unknown errors", async () => {
      const { caller, db } = makeCaller();
      db.notification.groupBy.mockRejectedValue(new Error("boom"));

      await expect(caller.getStats()).rejects.toMatchObject({
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal database error",
      });
    });
  });

  describe("markAllAsRead", () => {
    it("updates unread notifications and returns the count", async () => {
      const { caller, db } = makeCaller();
      db.notification.updateMany.mockResolvedValue({ count: 4 });

      await expect(caller.markAllAsRead({})).resolves.toEqual({
        message: "Marked 4 notifications as read",
        success: true,
        updatedCount: 4,
      });
      expect(db.notification.updateMany).toHaveBeenCalledWith({
        data: { isRead: true },
        where: { isRead: false },
      });
    });
  });

  describe("markAs", () => {
    it("marks as read", async () => {
      const { caller, db } = makeCaller();
      db.notification.update.mockResolvedValue({ id: 1 });

      await expect(caller.markAs({ id: UUID_A, isRead: true })).resolves.toEqual({
        message: "Marked as read",
        success: true,
      });
      expect(db.notification.update).toHaveBeenCalledWith({
        data: { isRead: true },
        where: { publicId: UUID_A },
      });
    });

    it("marks as unread", async () => {
      const { caller, db } = makeCaller();
      db.notification.update.mockResolvedValue({ id: 1 });

      await expect(caller.markAs({ id: UUID_A, isRead: false })).resolves.toEqual({
        message: "Marked as unread",
        success: true,
      });
    });
  });

  describe("validation and auth", () => {
    it("rejects non-uuid ids with BAD_REQUEST", async () => {
      const { caller } = makeCaller();
      await expect(caller.deleteOne({ id: "nope" })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    });

    it("rejects with UNAUTHORIZED when session is null", async () => {
      const { caller } = makeCaller({ session: null });
      await expect(caller.getAll({})).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });

    it("rejects partially-specified repo filters on the bulk schema", async () => {
      const { caller } = makeCaller();
      await expect(caller.markAllAsRead({ repoName: "doxynix" })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    });
  });
});
