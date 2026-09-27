import { NotifyType } from "@doxynix/shared";
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
  it("should return empty object when filters are not provided", () => {
    expect(notificationsService.buildWhereClause({})).toEqual({});
  });

  it("should combine raw and tokenized search filters for slug-like input", () => {
    const where = notificationsService.buildWhereClause({
      search: "  @tanstack/react-query  ",
    });

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
    });
  });

  it("should build exact repo filter and primitive filters", () => {
    const where = notificationsService.buildWhereClause({
      isRead: false,
      repoName: "react-query",
      repoOwner: "TanStack",
      type: NotifyType.WARNING,
    });

    expect(where).toEqual({
      isRead: false,
      repo: {
        is: {
          name: { equals: "react-query", mode: "insensitive" },
          owner: { equals: "TanStack", mode: "insensitive" },
        },
      },
      type: NotifyType.WARNING,
    });
  });
});

const MAX_PAGE = 1_000_000;

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

describe("notificationsService.getAll page clamping", () => {
  it.each([
    { cursor: 0, expectedSkip: 0, label: "zero" },
    { cursor: 1, expectedSkip: 0, label: "one" },
    { cursor: -5, expectedSkip: 0, label: "negative" },
    { cursor: undefined, expectedSkip: 0, label: "missing" },
    { cursor: 3, expectedSkip: 20, label: "in range" },
  ])(
    "should translate a $label cursor into skip $expectedSkip",
    async ({ cursor, expectedSkip }) => {
      const { db, findMany } = createNotificationDbMock();

      await notificationsService.getAll(db, { cursor, limit: 10 });

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: expectedSkip, take: 10 }),
      );
    },
  );

  it("should cap a cursor above the maximum so skip cannot explode", async () => {
    const { db, findMany } = createNotificationDbMock();

    await notificationsService.getAll(db, { cursor: MAX_PAGE + 1, limit: 100 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: (MAX_PAGE - 1) * 100, take: 100 }),
    );
  });
});

describe("notificationsService.getAll counts", () => {
  it("should derive totalCount from filteredCount and skip the unfiltered count when unfiltered", async () => {
    const { count, db } = createNotificationDbMock();
    count.mockResolvedValue(42);

    const result = await notificationsService.getAll(db, { limit: 10 });

    expect(count).toHaveBeenCalledTimes(1);
    expect(count).toHaveBeenCalledWith({ where: {} });
    expect(result.meta.totalCount).toBe(42);
    expect(result.meta.filteredCount).toBe(42);
    expect(result.meta.totalPages).toBe(5);
    expect(result.meta.nextCursor).toBe(2);
  });

  it("should keep the unfiltered totalCount when a filter is active", async () => {
    const { count, db } = createNotificationDbMock();
    count.mockResolvedValueOnce(3).mockResolvedValueOnce(100);

    const result = await notificationsService.getAll(db, { isRead: false, limit: 10 });

    expect(count).toHaveBeenCalledTimes(2);
    expect(count).toHaveBeenCalledWith({ where: { isRead: false } });
    expect(count).toHaveBeenCalledWith();
    expect(result.meta.filteredCount).toBe(3);
    expect(result.meta.totalCount).toBe(100);
    expect(result.meta.totalPages).toBe(1);
  });

  it("should report totalCount 0 rather than falling back when the unfiltered table is empty", async () => {
    const { count, db } = createNotificationDbMock();
    count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

    const result = await notificationsService.getAll(db, { limit: 10, search: "nope" });

    expect(result.meta.filteredCount).toBe(0);
    expect(result.meta.totalCount).toBe(0);
    expect(result.meta.totalPages).toBe(1);
    expect(result.meta.nextCursor).toBeUndefined();
  });
});

describe("notificationsService.getStats", () => {
  it("should count both groups when both are present", async () => {
    const { db, groupBy } = createNotificationDbMock();
    groupBy.mockResolvedValue([
      { _count: { _all: 7 }, isRead: true },
      { _count: { _all: 3 }, isRead: false },
    ]);

    await expect(notificationsService.getStats(db)).resolves.toEqual({
      read: 7,
      total: 10,
      unread: 3,
    });
    expect(groupBy).toHaveBeenCalledWith({ _count: { _all: true }, by: ["isRead"] });
  });

  it("should report read 0 when only unread rows exist", async () => {
    const { db, groupBy } = createNotificationDbMock();
    groupBy.mockResolvedValue([{ _count: { _all: 4 }, isRead: false }]);

    await expect(notificationsService.getStats(db)).resolves.toEqual({
      read: 0,
      total: 4,
      unread: 4,
    });
  });

  it("should report unread 0 when only read rows exist", async () => {
    const { db, groupBy } = createNotificationDbMock();
    groupBy.mockResolvedValue([{ _count: { _all: 9 }, isRead: true }]);

    await expect(notificationsService.getStats(db)).resolves.toEqual({
      read: 9,
      total: 9,
      unread: 0,
    });
  });

  it("should report zeroes for an empty table", async () => {
    const { db, groupBy } = createNotificationDbMock();
    groupBy.mockResolvedValue([]);

    await expect(notificationsService.getStats(db)).resolves.toEqual({
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

    const result = await notificationsService.deleteRead(db, {});

    expect(deleteMany).toHaveBeenCalledWith({ where: { isRead: true } });
    expect(result).toEqual({
      deletedCount: 2,
      message: "Deleted 2 read notifications",
      success: true,
    });
  });

  it("should keep the filter alongside the isRead guard", async () => {
    const { db, deleteMany } = createNotificationDbMock();

    await notificationsService.deleteRead(db, { type: NotifyType.WARNING });

    expect(deleteMany).toHaveBeenCalledWith({ where: { isRead: true, type: NotifyType.WARNING } });
  });
});

describe("notificationsService.markAllAsRead", () => {
  it("should only update unread rows", async () => {
    const { db, updateMany } = createNotificationDbMock();
    updateMany.mockResolvedValue({ count: 5 });

    const result = await notificationsService.markAllAsRead(db, {});

    expect(updateMany).toHaveBeenCalledWith({
      data: { isRead: true },
      where: { isRead: false },
    });
    expect(result).toEqual({
      message: "Marked 5 notifications as read",
      success: true,
      updatedCount: 5,
    });
  });

  it("should keep the filter alongside the isRead guard", async () => {
    const { db, updateMany } = createNotificationDbMock();

    await notificationsService.markAllAsRead(db, { type: NotifyType.ERROR });

    expect(updateMany).toHaveBeenCalledWith({
      data: { isRead: true },
      where: { isRead: false, type: NotifyType.ERROR },
    });
  });
});
