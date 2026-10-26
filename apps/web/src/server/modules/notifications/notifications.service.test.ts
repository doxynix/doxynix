import { MAX_PAGE, NotifyType } from "@doxynix/shared";
import { describe, expect, it, vi } from "vitest";

import type { DbClient } from "@/server/core/db";
import { notificationsService } from "@/server/modules/notifications/notifications.service";

function buildSearchClause(term: string) {
  return {
    OR: [
      { title: { contains: term, mode: "insensitive" } },
      { body: { contains: term, mode: "insensitive" } },
      {
        repo: {
          is: {
            OR: [
              { name: { contains: term, mode: "insensitive" } },
              { owner: { contains: term, mode: "insensitive" } },
            ],
          },
        },
      },
    ],
  };
}

describe("notificationsService.buildWhereClause", () => {
  it("should still scope to the owner when no filters are given", () => {
    // This is the clause every bulk operation rides on. `deleteRead({})` reached
    // `deleteMany({ isRead: true })` before, which reads as "mine" only because the policy layer
    // says so; the assertion pins the owner here instead.
    expect(notificationsService.buildWhereClause({}, "user-1")).toEqual({ userId: "user-1" });
  });

  it("should combine raw and tokenized search filters for slug-like input", () => {
    const where = notificationsService.buildWhereClause(
      {
        search: "  @tanstack/react-query  ",
      },
      "user-1",
    );

    expect(where).toEqual({
      OR: [
        buildSearchClause("@tanstack/react-query"),
        {
          AND: [
            buildSearchClause("tanstack"),
            buildSearchClause("react"),
            buildSearchClause("query"),
          ],
        },
      ],
      userId: "user-1",
    });
  });

  it("should build exact repo filter and primitive filters", () => {
    const where = notificationsService.buildWhereClause(
      {
        isRead: false,
        repoName: "react-query",
        repoOwner: "TanStack",
        type: NotifyType.WARNING,
      },
      "user-1",
    );

    expect(where).toEqual({
      isRead: false,
      repo: {
        is: {
          name: { equals: "react-query", mode: "insensitive" },
          owner: { equals: "TanStack", mode: "insensitive" },
        },
      },
      type: NotifyType.WARNING,
      userId: "user-1",
    });
  });
});

function createNotificationDbMock(rows: unknown[] = []) {
  const count = vi.fn().mockResolvedValue(0);
  const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
  const findMany = vi.fn().mockResolvedValue(rows);
  const groupBy = vi.fn().mockResolvedValue([]);
  const updateMany = vi.fn().mockResolvedValue({ count: 0 });

  const db = {
    notification: { count, deleteMany, findMany, groupBy, updateMany },
  } as unknown as DbClient;

  return { count, db, deleteMany, findMany, groupBy, updateMany };
}

describe("notificationsService.getFeed keyset", () => {
  const row = (id: string) => ({
    body: "body",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    id,
    isRead: false,
    repo: null,
    title: "title",
    type: NotifyType.INFO,
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  });

  it("pages by cursor instead of skip and over-fetches one probe row", async () => {
    const { db, findMany } = createNotificationDbMock([row("a"), row("b")]);

    await notificationsService.getFeed(db, { cursor: "a", limit: 2 }, "user-1");

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: "a" }, take: 3 }),
    );
    expect(findMany.mock.calls[0]?.[0]).not.toHaveProperty("skip");
  });

  it("omits the cursor on the first page", async () => {
    const { db, findMany } = createNotificationDbMock([]);

    await notificationsService.getFeed(db, { limit: 2 }, "user-1");

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ cursor: undefined }));
  });

  it("stops at a short page and reports no cursor", async () => {
    const { db } = createNotificationDbMock([row("a"), row("b")]);

    const result = await notificationsService.getFeed(db, { limit: 5 }, "user-1");

    expect(result.items).toHaveLength(2);
    expect(result.meta).toStrictEqual({ hasNextPage: false, nextCursor: undefined });
  });

  it("drops the probe row and hands back its id as the next cursor", async () => {
    const { db } = createNotificationDbMock([row("a"), row("b"), row("c")]);

    const result = await notificationsService.getFeed(db, { limit: 2 }, "user-1");

    expect(result.items.map((item) => item.id)).toStrictEqual(["a", "b"]);
    expect(result.meta).toStrictEqual({ hasNextPage: true, nextCursor: "c" });
  });

  it("scopes to the owner and passes the optional filters through", async () => {
    const { db, findMany } = createNotificationDbMock([]);

    await notificationsService.getFeed(
      db,
      { isRead: false, limit: 2, type: NotifyType.WARNING },
      "user-1",
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isRead: false, type: NotifyType.WARNING, userId: "user-1" },
      }),
    );
  });

  it("omits the optional keys entirely when unset", async () => {
    const { db, findMany } = createNotificationDbMock([]);

    await notificationsService.getFeed(db, { limit: 2 }, "user-1");

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "user-1" } }));
  });
});

describe("notificationsService.getAll page clamping", () => {
  it.each([
    { expectedSkip: 0, label: "zero", page: 0 },
    { expectedSkip: 0, label: "one", page: 1 },
    { expectedSkip: 0, label: "negative", page: -5 },
    { expectedSkip: 0, label: "missing", page: undefined },
    { expectedSkip: 20, label: "in range", page: 3 },
  ])("should translate a $label page into skip $expectedSkip", async ({ expectedSkip, page }) => {
    const { db, findMany } = createNotificationDbMock();

    await notificationsService.getAll(db, { limit: 10, page }, "user-1");

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: expectedSkip, take: 10 }),
    );
  });

  it("should cap a page above the maximum so skip cannot explode", async () => {
    const { db, findMany } = createNotificationDbMock();

    await notificationsService.getAll(db, { limit: 100, page: MAX_PAGE + 1 }, "user-1");

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: (MAX_PAGE - 1) * 100, take: 100 }),
    );
  });
});

describe("notificationsService.getAll counts", () => {
  it("should derive totalCount from filteredCount and skip the unfiltered count when unfiltered", async () => {
    const { findMany, db } = createNotificationDbMock([{}, {}, {}, {}, {}] as never[]);
    const rows = Array.from({ length: 42 }, (_, i) => ({ id: `n${i}` }));
    findMany.mockResolvedValueOnce([]).mockResolvedValue(rows);

    const result = await notificationsService.getAll(db, { limit: 10 }, "user-1");

    // No unfiltered pass: the only extra findMany is the id-only capped count.
    expect(findMany).toHaveBeenCalledTimes(2);
    expect(result.meta.totalCount).toBe(42);
    expect(result.meta.filteredCount).toBe(42);
    expect(result.meta.totalPages).toBe(5);
    expect(result.meta.hasNextPage).toBe(true);
  });

  it("should keep the unfiltered totalCount when a filter is active", async () => {
    const { findMany, db } = createNotificationDbMock();
    findMany
      .mockResolvedValueOnce([]) // page
      .mockResolvedValueOnce(Array.from({ length: 3 }, (_, i) => ({ id: `f${i}` })))
      .mockResolvedValueOnce(Array.from({ length: 100 }, (_, i) => ({ id: `u${i}` })));

    const result = await notificationsService.getAll(db, { isRead: false, limit: 10 }, "user-1");

    expect(findMany).toHaveBeenCalledTimes(3);
    expect(result.meta.filteredCount).toBe(3);
    expect(result.meta.totalCount).toBe(100);
    expect(result.meta.totalPages).toBe(1);
  });

  it("should cap the count at MAX_PAGE pages so a broad filter cannot stall the request", async () => {
    const { findMany, db } = createNotificationDbMock();
    findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await notificationsService.getAll(db, { limit: 10 }, "user-1");

    const countCall = findMany.mock.calls.at(-1);
    expect(countCall?.[0]).toMatchObject({ select: { id: true } });
    expect(countCall?.[0]).toMatchObject({ take: MAX_PAGE * 10 });
  });

  it("should report totalCount 0 rather than falling back when the unfiltered table is empty", async () => {
    const { count, db } = createNotificationDbMock();
    count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

    const result = await notificationsService.getAll(db, { limit: 10, search: "nope" }, "user-1");

    expect(result.meta.filteredCount).toBe(0);
    expect(result.meta.totalCount).toBe(0);
    expect(result.meta.totalPages).toBe(1);
    expect(result.meta.hasNextPage).toBe(false);
  });
});

describe("notificationsService.getStats", () => {
  it("should count both groups when both are present", async () => {
    const { db, groupBy } = createNotificationDbMock();
    groupBy.mockResolvedValue([
      { _count: { _all: 7 }, isRead: true },
      { _count: { _all: 3 }, isRead: false },
    ]);

    await expect(notificationsService.getStats(db, "user-1")).resolves.toEqual({
      read: 7,
      total: 10,
      unread: 3,
    });
    expect(groupBy).toHaveBeenCalledWith({
      _count: { _all: true },
      by: ["isRead"],
      where: { userId: "user-1" },
    });
  });

  it("should report read 0 when only unread rows exist", async () => {
    const { db, groupBy } = createNotificationDbMock();
    groupBy.mockResolvedValue([{ _count: { _all: 4 }, isRead: false }]);

    await expect(notificationsService.getStats(db, "user-1")).resolves.toEqual({
      read: 0,
      total: 4,
      unread: 4,
    });
  });

  it("should report unread 0 when only read rows exist", async () => {
    const { db, groupBy } = createNotificationDbMock();
    groupBy.mockResolvedValue([{ _count: { _all: 9 }, isRead: true }]);

    await expect(notificationsService.getStats(db, "user-1")).resolves.toEqual({
      read: 9,
      total: 9,
      unread: 0,
    });
  });

  it("should report zeroes for an empty table", async () => {
    const { db, groupBy } = createNotificationDbMock();
    groupBy.mockResolvedValue([]);

    await expect(notificationsService.getStats(db, "user-1")).resolves.toEqual({
      read: 0,
      total: 0,
      unread: 0,
    });
  });
});

describe("notificationsService.deleteRead", () => {
  it("should only delete read rows", async () => {
    const { db, deleteMany } = createNotificationDbMock();
    deleteMany.mockResolvedValue({ count: 2 });

    const result = await notificationsService.deleteRead(db, {}, "user-1");

    expect(deleteMany).toHaveBeenCalledWith({ where: { isRead: true, userId: "user-1" } });
    expect(result).toEqual({ deletedCount: 2, success: true });
  });

  it("should keep the filter alongside the isRead guard", async () => {
    const { db, deleteMany } = createNotificationDbMock();

    await notificationsService.deleteRead(db, { type: NotifyType.WARNING }, "user-1");

    expect(deleteMany).toHaveBeenCalledWith({
      where: { isRead: true, type: NotifyType.WARNING, userId: "user-1" },
    });
  });
});

describe("notificationsService.markAllAsRead", () => {
  it("should only update unread rows", async () => {
    const { db, updateMany } = createNotificationDbMock();
    updateMany.mockResolvedValue({ count: 5 });

    const result = await notificationsService.markAllAsRead(db, {}, "user-1");

    expect(updateMany).toHaveBeenCalledWith({
      data: { isRead: true },
      where: { isRead: false, userId: "user-1" },
    });
    expect(result).toEqual({ success: true, updatedCount: 5 });
  });

  it("should keep the filter alongside the isRead guard", async () => {
    const { db, updateMany } = createNotificationDbMock();

    await notificationsService.markAllAsRead(db, { type: NotifyType.ERROR }, "user-1");

    expect(updateMany).toHaveBeenCalledWith({
      data: { isRead: true },
      where: { isRead: false, type: NotifyType.ERROR, userId: "user-1" },
    });
  });
});
