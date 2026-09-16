import type { AuditLog } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  appLogger: { debug: vi.fn(), error: vi.fn(), flush: vi.fn(), info: vi.fn(), warn: vi.fn() },
  enhance: vi.fn((db: unknown) => db),
  highlightCode: vi.fn(
    (code: string, _lang: string, _theme: string, id: string) => `<span id="${id}">${code}</span>`,
  ),
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
vi.mock("@/shared/lib/shiki", () => ({ highlightCode: mocks.highlightCode }));

import { createCallerFactory } from "@/server/core/trpc/init";
import { AUDIT_BUSINESS_MODELS } from "@/server/utils/constants";

import { mapAuditLogToDTO } from "./audit.mapper";
import { auditRouter } from "./audit.router";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeAuditLog(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    createdAt: new Date("2024-01-01T00:00:00Z"),
    id: "log-1",
    ip: "1.2.3.4",
    model: "Repo",
    operation: "create",
    payload: { data: { name: "my-repo" } },
    requestId: "req-1",
    userAgent: null,
    userId: 7,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Caller helpers
// ---------------------------------------------------------------------------

function makeDb() {
  return {
    auditLog: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  };
}

const createCaller = createCallerFactory(auditRouter);

function makeCaller(db: ReturnType<typeof makeDb>, overrides: Record<string, unknown> = {}) {
  const ctx = {
    db: {},
    prisma: db,
    redis: null,
    req: {},
    requestInfo: {},
    session: { user: { id: "7" } },
    ...overrides,
  };
  return createCaller(ctx as never);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("auditRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getActivityLogs", () => {
    it("returns mapped DTOs and no nextCursor when rows fit within limit", async () => {
      const db = makeDb();
      const rows = [makeAuditLog(), makeAuditLog({ id: "log-2" }), makeAuditLog({ id: "log-3" })];
      db.auditLog.findMany.mockResolvedValue(rows);

      const result = await makeCaller(db).getActivityLogs({});

      expect(result.nextCursor).toBeUndefined();
      expect(result.items).toHaveLength(3);
      expect(result.items).toEqual(rows.map((row) => mapAuditLogToDTO(row)));
      expect(result.items[0]).toMatchObject({
        actionTitle: "Created",
        entityType: "Repository",
        iconKey: "github",
        severity: "success",
        targetName: "my-repo",
      });
      expect(db.auditLog.findMany).toHaveBeenCalledWith({
        cursor: undefined,
        orderBy: { createdAt: "desc" },
        take: 21,
        where: { model: { in: AUDIT_BUSINESS_MODELS }, userId: 7 },
      });
    });

    it("pops the extra row beyond the limit and returns its id as nextCursor", async () => {
      const db = makeDb();
      const rows = Array.from({ length: 21 }, (_, i) => makeAuditLog({ id: `log-${i + 1}` }));
      db.auditLog.findMany.mockResolvedValue(rows);

      const result = await makeCaller(db).getActivityLogs({});

      expect(result.items).toHaveLength(20);
      expect(result.items[0]!.id).toBe("log-1");
      expect(result.nextCursor).toBe("log-21");
      expect(db.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 21 }));
    });

    it("honors a custom limit by fetching limit + 1 rows", async () => {
      const db = makeDb();
      db.auditLog.findMany.mockResolvedValue([makeAuditLog(), makeAuditLog({ id: "log-2" })]);

      const result = await makeCaller(db).getActivityLogs({ limit: 5 });

      expect(result.items).toHaveLength(2);
      expect(result.nextCursor).toBeUndefined();
      expect(db.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 6 }));
    });

    it("rejects with BAD_REQUEST for out-of-range limit", async () => {
      const db = makeDb();
      const caller = makeCaller(db);

      await expect(caller.getActivityLogs({ limit: 101 })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      await expect(caller.getActivityLogs({ limit: 0 })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      expect(db.auditLog.findMany).not.toHaveBeenCalled();
    });
  });

  describe("getLogPayloadHtml", () => {
    it("sanitizes the payload and returns highlighted HTML", async () => {
      const db = makeDb();
      db.auditLog.findUnique.mockResolvedValue({
        payload: { detail: { nested: 1 }, id: "SECRET_ID", name: "x" },
      });

      const html = await makeCaller(db).getLogPayloadHtml({ logId: "log-1" });

      const jsonString = JSON.stringify({ detail: { nested: 1 }, name: "x" }, null, 2);
      expect(html).toBe(`<span id="log-1">${jsonString}</span>`);
      expect(mocks.highlightCode).toHaveBeenCalledWith(jsonString, "json", "dark", "log-1");
      expect(db.auditLog.findUnique).toHaveBeenCalledWith({
        select: { payload: true },
        where: { id: "log-1", userId: 7 },
      });
    });

    it("rejects with NOT_FOUND when the log does not exist", async () => {
      const db = makeDb();
      db.auditLog.findUnique.mockResolvedValue(null);

      await expect(makeCaller(db).getLogPayloadHtml({ logId: "log-1" })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });

      expect(db.auditLog.findUnique).toHaveBeenCalledWith({
        select: { payload: true },
        where: { id: "log-1", userId: 7 },
      });
      expect(mocks.highlightCode).not.toHaveBeenCalled();
    });
  });

  it("rejects with UNAUTHORIZED when session is null", async () => {
    const db = makeDb();
    const caller = makeCaller(db, { session: null });

    await expect(caller.getActivityLogs({})).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.getLogPayloadHtml({ logId: "log-1" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(db.auditLog.findMany).not.toHaveBeenCalled();
    expect(db.auditLog.findUnique).not.toHaveBeenCalled();
  });
});
