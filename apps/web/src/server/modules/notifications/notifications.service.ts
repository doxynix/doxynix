import type { Prisma } from "@prisma/client";

import type { DbClient } from "@/server/core/db";
import { handlePrismaError } from "@/server/utils/handle-error";
import { clampPage, getPaginationMeta } from "@/server/utils/pagination";
import { normalizeSearchInput, tokenizeSearchInput } from "@/server/utils/search";

import { notificationMapper } from "./notification.mapper";
import type {
  NotificationsBulkFilterInput,
  NotificationsFilterInput,
} from "./notification.schemas";

function buildNotificationSearchClause(term: string): Prisma.NotificationWhereInput {
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

export const notificationsService = {
  buildWhereClause(filters: Partial<NotificationsFilterInput>): Prisma.NotificationWhereInput {
    const normalizedRepoName = filters.repoName?.trim();
    const normalizedRepoOwner = filters.repoOwner?.trim();
    const normalizedSearch = normalizeSearchInput(filters.search ?? undefined);
    const repoSearchTerms = tokenizeSearchInput(filters.search ?? undefined);

    const rawSearchFilter: Prisma.NotificationWhereInput =
      normalizedSearch != null ? buildNotificationSearchClause(normalizedSearch) : {};

    const tokenSearchFilter: Prisma.NotificationWhereInput =
      repoSearchTerms.length > 0
        ? { AND: repoSearchTerms.map((term) => buildNotificationSearchClause(term)) }
        : {};

    const searchFilter: Prisma.NotificationWhereInput =
      normalizedSearch != null && repoSearchTerms.length > 0
        ? normalizedSearch === repoSearchTerms[0] && repoSearchTerms.length === 1
          ? rawSearchFilter
          : { OR: [rawSearchFilter, tokenSearchFilter] }
        : rawSearchFilter;

    const repoFilter: Prisma.NotificationWhereInput =
      normalizedRepoOwner != null &&
      normalizedRepoOwner.length > 0 &&
      normalizedRepoName != null &&
      normalizedRepoName.length > 0
        ? {
            repo: {
              is: {
                name: { equals: normalizedRepoName, mode: "insensitive" },
                owner: { equals: normalizedRepoOwner, mode: "insensitive" },
              },
            },
          }
        : {};

    return {
      ...(filters.type != null && { type: filters.type }),
      ...(typeof filters.isRead === "boolean" && { isRead: filters.isRead }),
      ...searchFilter,
      ...repoFilter,
    };
  },

  async deleteOne(db: DbClient, id: string) {
    try {
      await db.notification.delete({ where: { publicId: id } });

      return { message: "Notification deleted", success: true };
    } catch (error) {
      handlePrismaError(error, { notFound: "Notification not found" });
    }
  },

  async deleteRead(db: DbClient, input: NotificationsBulkFilterInput) {
    const where = this.buildWhereClause(input);

    try {
      const result = await db.notification.deleteMany({ where: { ...where, isRead: true } });

      return {
        deletedCount: result.count,
        message: `Deleted ${result.count} read notifications`,
        success: true,
      };
    } catch (error) {
      handlePrismaError(error, { notFound: "Notification not found" });
    }
  },

  async getAll(db: DbClient, input: NotificationsFilterInput) {
    const { cursor, isRead, limit, repoName, repoOwner, search, type } = input;

    const page = clampPage(cursor);
    const skip = (page - 1) * limit;

    const where = this.buildWhereClause({ isRead, repoName, repoOwner, search, type });
    const isUnfiltered = Object.keys(where).length === 0;

    const [items, filteredCount, unfilteredCount] = await Promise.all([
      db.notification.findMany({
        include: { repo: { select: { name: true, owner: true } } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take: limit,
        where,
      }),
      db.notification.count({ where }),
      isUnfiltered ? null : db.notification.count(),
    ]);

    const meta = getPaginationMeta({
      filteredCount,
      limit,
      page,
      search: search ?? undefined,
      totalCount: unfilteredCount ?? filteredCount,
    });

    return notificationMapper.toPaginatedList(items, meta);
  },

  async getStats(db: DbClient) {
    try {
      const groups = await db.notification.groupBy({
        _count: { _all: true },
        by: ["isRead"],
      });

      const read = groups.find((g) => g.isRead)?._count._all ?? 0;
      const unread = groups.find((g) => !g.isRead)?._count._all ?? 0;

      return { read, total: read + unread, unread };
    } catch (error) {
      handlePrismaError(error);
    }
  },

  async markAllAsRead(db: DbClient, input: NotificationsBulkFilterInput) {
    const where = this.buildWhereClause(input);

    try {
      const result = await db.notification.updateMany({
        data: { isRead: true },
        where: { ...where, isRead: false },
      });

      const updatedCount = result.count;

      return {
        message: `Marked ${updatedCount} notifications as read`,
        success: true,
        updatedCount,
      };
    } catch (error) {
      handlePrismaError(error);
    }
  },

  async markAs(db: DbClient, id: string, isRead: boolean) {
    try {
      await db.notification.update({ data: { isRead }, where: { publicId: id } });

      return { message: isRead ? "Marked as read" : "Marked as unread", success: true };
    } catch (error) {
      handlePrismaError(error, { notFound: "Notification not found" });
    }
  },
};
