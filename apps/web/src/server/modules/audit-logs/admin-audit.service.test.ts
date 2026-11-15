import { AuditModel, AuditOperation } from "@doxynix/shared";
import { describe, expect, it, vi } from "vitest";

import type { DbClient } from "@/server/core/db";

import { adminAuditService } from "./admin-audit.service";

const USER_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d";
const CURSOR = "0192f0aa-2222-7000-8000-000000000002";

function makeLog(id: string) {
  return {
    createdAt: new Date("2026-03-01T10:00:00Z"),
    id,
    ip: null,
    model: AuditModel.Repo,
    operation: AuditOperation.UPDATE,
    payload: {},
    requestId: "req-1",
    userAgent: "vitest",
    userId: USER_ID,
  };
}

function createDbMock(rows: unknown[] = []) {
  const findMany = vi.fn().mockResolvedValue(rows);
  const db = { auditLog: { findMany } } as unknown as DbClient;

  return { db, findMany };
}

describe("adminAuditService.getAll", () => {
  it("reads one probe row past the newest-first page, once", async () => {
    const { db, findMany } = createDbMock([makeLog(CURSOR)]);

    const result = await adminAuditService.getAll(db, { limit: 20 });

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      cursor: undefined,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 21,
      where: {},
    });
    expect(result.meta).toEqual({ hasNextPage: false, nextCursor: undefined });
  });

  it("keysets past the cursor id", async () => {
    const { db, findMany } = createDbMock([makeLog(CURSOR)]);

    await adminAuditService.getAll(db, { cursor: CURSOR, limit: 20 });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ cursor: { id: CURSOR } }));
  });

  it("turns the probe row into the next cursor instead of a row", async () => {
    const { db } = createDbMock([makeLog("page-1"), makeLog(CURSOR)]);

    const result = await adminAuditService.getAll(db, { limit: 1 });

    expect(result.items.map((item) => item.id)).toEqual(["page-1"]);
    expect(result.meta).toEqual({ hasNextPage: true, nextCursor: CURSOR });
  });

  it("keeps the model, operation, search and date filters in the where clause", async () => {
    const { db, findMany } = createDbMock();

    await adminAuditService.getAll(db, {
      from: new Date("2026-01-01"),
      limit: 20,
      model: AuditModel.Repo,
      operation: AuditOperation.UPDATE,
      search: "  req-1 ",
      to: new Date("2026-02-01"),
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          createdAt: { gte: new Date("2026-01-01"), lt: new Date("2026-02-02") },
          model: AuditModel.Repo,
          operation: AuditOperation.UPDATE,
          requestId: { contains: "req-1", mode: "insensitive" },
        },
      }),
    );
  });
});
