import type { NotifyType, Prisma } from "@prisma/client";

import type { NotificationsBulkFilterInput, NotificationsFilterInput } from "../api/contracts";
import {
  notificationPresenter,
  type NotificationWithRepo,
} from "../api/presenters/notification.presenter";
import type { DbClient } from "../db/db";
import { handlePrismaError } from "../utils/handle-error";
import { getPaginationMeta } from "../utils/pagination";
import { normalizeSearchInput, tokenizeSearchInput } from "../utils/search";

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
      ...(filters.type != null && { type: filters.type as NotifyType }),
      ...(typeof filters.isRead === "boolean" && { isRead: filters.isRead }),
      ...searchFilter,
      ...repoFilter,
    };
  },

  async deleteOne(db: DbClient, id: string) {
    try {
      await db.notification.delete({
        where: { publicId: id },
      });

      return { message: "Notification deleted", success: true };
    } catch (error) {
      handlePrismaError(error, { notFound: "Notification not found" });
    }
  },

  async deleteRead(db: DbClient, filters: NotificationsBulkFilterInput) {
    const where = this.buildWhereClause(filters);

    try {
      await db.notification.deleteMany({
        where: { ...where, isRead: true },
      });
      return { message: "All read notifications were deleted", success: true };
    } catch (error) {
      handlePrismaError(error, { notFound: "Notification not found" });
    }
  },

  async getAll(db: DbClient, input: NotificationsFilterInput) {
    const { cursor, isRead, limit, repoName, repoOwner, search, type } = input;

    const page = Math.min(Math.max(1, cursor ?? 1), 1000000);
    const skip = (page - 1) * limit;

    const where = this.buildWhereClause({ isRead, repoName, repoOwner, search, type });

    const [items, totalCount, filteredCount] = await Promise.all([
      db.notification.findMany({
        include: { repo: { select: { name: true, owner: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        where,
      }),
      db.notification.count(),
      db.notification.count({ where }),
    ]);

    const meta = getPaginationMeta({
      filteredCount,
      limit,
      page,
      search: search ?? undefined,
      totalCount,
    });

    return notificationPresenter.toPaginatedList(items as NotificationWithRepo[], meta);
  },

  async getStats(db: DbClient) {
    try {
      const groups = await db.notification.groupBy({
        _count: { _all: true },
        by: ["isRead"],
      });

      return groups.reduce(
        (acc, group) => {
          if (group.isRead === true) acc.read = group._count._all;
          else acc.unread = group._count._all;
          acc.total += group._count._all;
          return acc;
        },
        { read: 0, total: 0, unread: 0 }
      );
    } catch (error) {
      handlePrismaError(error);
    }
  },

  async markAllAsRead(db: DbClient, filters: NotificationsBulkFilterInput) {
    const where = this.buildWhereClause(filters);

    try {
      const updatedCount = (
        await db.notification.updateMany({
          data: {
            isRead: true,
          },
          where: {
            ...where,
            isRead: false,
          },
        })
      ).count;

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
      await db.notification.update({
        data: { isRead },
        where: { publicId: id },
      });
      return { message: isRead ? "Marked as read" : "Marked as unread", success: true };
    } catch (error) {
      handlePrismaError(error, { notFound: "Notification not found" });
    }
  },
};
