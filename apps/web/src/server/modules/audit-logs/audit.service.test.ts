import { describe, expect, it, vi } from "vitest";

import type { DbClient } from "@/server/core/db";
import { auditService } from "@/server/modules/audit-logs/audit.service";

function createAuditDbMock(rows: unknown[] = []) {
  const findMany = vi.fn().mockResolvedValue(rows);
  const db = { auditLog: { findMany } } as unknown as DbClient;

  return { db, findMany };
}

function makeAuditLog(id: string) {
  return {
    createdAt: new Date("2025-03-01T10:00:00Z"),
    id,
    ip: null,
    model: "Repo",
    operation: "create",
    payload: {},
    requestId: "req-1",
    userAgent: "vitest",
    userId: 1,
  };
}

describe("auditService.getActivityLogs pagination", () => {
  it("should order by createdAt desc with an id tiebreaker", async () => {
    const { db, findMany } = createAuditDbMock();

    await auditService.getActivityLogs(db, 1, { limit: 20 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ createdAt: "desc" }, { id: "desc" }] }),
    );
  });

  it("should keep the id cursor and take limit + 1", async () => {
    const { db, findMany } = createAuditDbMock();

    await auditService.getActivityLogs(db, 1, {
      cursor: "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
      limit: 20,
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b" },
        take: 21,
      }),
    );
  });

  it("should omit the cursor on the first page", async () => {
    const { db, findMany } = createAuditDbMock();

    await auditService.getActivityLogs(db, 1, { limit: 20 });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ cursor: undefined }));
  });

  it("should return no nextCursor when the page is not full", async () => {
    const { db } = createAuditDbMock([makeAuditLog("a"), makeAuditLog("b")]);

    const result = await auditService.getActivityLogs(db, 1, { limit: 20 });

    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBeUndefined();
  });

  it("should emit the extra row id as the nextCursor on a full page", async () => {
    const { db } = createAuditDbMock([makeAuditLog("a"), makeAuditLog("b"), makeAuditLog("c")]);

    const result = await auditService.getActivityLogs(db, 1, { limit: 2 });

    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBe("c");
  });
});
