import { describe, expect, it, vi } from "vitest";

import type { DbClient } from "@/server/core/db";
import { auditService } from "@/server/modules/audit-logs/audit.service";

function createAuditDbMock(rows: unknown[] = []) {
  const findMany = vi.fn().mockResolvedValue(rows);
  const db = { auditLog: { findMany } } as unknown as DbClient;

  return { db, findMany };
}

const USER_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d";
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
    userId: USER_ID,
  };
}

describe("auditService.getActivityLogs pagination", () => {
  it("should order by createdAt desc with an id tiebreaker", async () => {
    const { db, findMany } = createAuditDbMock();

    await auditService.getActivityLogs(db, USER_ID, { limit: 20 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ createdAt: "desc" }, { id: "desc" }] }),
    );
  });

  // The cursor contract here is load-bearing on Prisma semantics, not on
  // anything `audit.service.ts` states. `findMany` with `cursor` and no
  // `skip` INCLUDES the cursor row in the result, and Prisma folds that into
  // the `OFFSET` it emits. So the service pops the lookahead row off
  // `take: limit + 1` and hands *that* row's id forward: page N+1 re-emits it
  // as its first row, and the pages tile without overlap or gap.
  //
  // Rewriting nextCursor as `items[limit - 1].id` — the more common shape —
  // without adding `skip: 1` would silently drop one row at every boundary,
  // and the only symptom would be a short final page.
  it("should keep the id cursor and take limit + 1", async () => {
    const { db, findMany } = createAuditDbMock();

    await auditService.getActivityLogs(db, USER_ID, {
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

    await auditService.getActivityLogs(db, USER_ID, { limit: 20 });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ cursor: undefined }));
  });

  it("should return no nextCursor when the page is not full", async () => {
    const { db } = createAuditDbMock([makeAuditLog("a"), makeAuditLog("b")]);

    const result = await auditService.getActivityLogs(db, USER_ID, { limit: 20 });

    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBeUndefined();
  });

  it("should emit the extra row id as the nextCursor on a full page", async () => {
    const { db } = createAuditDbMock([makeAuditLog("a"), makeAuditLog("b"), makeAuditLog("c")]);

    const result = await auditService.getActivityLogs(db, USER_ID, { limit: 2 });

    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBe("c");
  });
});
