import { MAX_PAGE } from "@doxynix/shared";
import type { Prisma } from "@prisma/client";

import { REALTIME_CONFIG } from "@/shared/config/realtime";

import type { DbClient } from "@/server/core/db";
import { realtimeService } from "@/server/core/realtime";
import { handlePrismaError } from "@/server/utils/handle-error";
import {
  buildDateRangeWhere,
  cappedCount,
  getPaginatedList,
  ORDER_CREATED_AT_DESC,
} from "@/server/utils/pagination";
import { normalizeSearchInput, tokenizeSearchInput } from "@/server/utils/search";

import { notificationMapper } from "./notification.mapper";
import type {
  NotificationsBulkFilterInput,
  NotificationsFeedInput,
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
  buildWhereClause(
    filters: Partial<NotificationsFilterInput>,
    userId: string,
  ): Prisma.NotificationWhereInput {
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
      userId,
      ...(filters.type != null && { type: filters.type }),
      ...(typeof filters.isRead === "boolean" && { isRead: filters.isRead }),
      ...buildDateRangeWhere(filters, "createdAt"),
      ...searchFilter,
      ...repoFilter,
    };
  },

  async deleteOne(db: DbClient, id: string, userId: string) {
    try {
      await db.notification.delete({ where: { id, userId } });

      void realtimeService
        .user(userId)
        .publish(REALTIME_CONFIG.events.user.notificationUpdated, {});

      return { success: true };
    } catch (error) {
      handlePrismaError(error, { notFound: "Notification not found" });
    }
  },

  async deleteRead(db: DbClient, input: NotificationsBulkFilterInput, userId: string) {
    const where = this.buildWhereClause(input, userId);

    try {
      const result = await db.notification.deleteMany({ where: { ...where, isRead: true } });

      void realtimeService
        .user(userId)
        .publish(REALTIME_CONFIG.events.user.notificationUpdated, {});

      return { deletedCount: result.count, success: true };
    } catch (error) {
      handlePrismaError(error, { notFound: "Notification not found" });
    }
  },

  async getAll(db: DbClient, input: NotificationsFilterInput, userId: string) {
    const { isRead, limit, page, repoName, repoOwner, search, type } = input;

    const where = this.buildWhereClause({ isRead, repoName, repoOwner, search, type }, userId);
    const isUnfiltered = Object.keys(where).every((key) => key === "userId");

    const cap = MAX_PAGE * limit;
    const countMatching = (filterWhere: Prisma.NotificationWhereInput) =>
      cappedCount(
        (take) => db.notification.findMany({ select: { id: true }, take, where: filterWhere }),
        cap,
      );

    const { items, meta } = await getPaginatedList({
      countCap: cap,
      countFiltered: () => countMatching(where),
      countUnfiltered: isUnfiltered ? null : () => countMatching({}),
      fetchItems: ({ skip, take }) =>
        db.notification.findMany({
          include: { repo: { select: { name: true, owner: true } } },
          orderBy: ORDER_CREATED_AT_DESC,
          skip,
          take,
          where,
        }),
      input: { limit, page, ...(search != null ? { search } : {}) },
    });

    return notificationMapper.toPaginatedList(items, meta);
  },

  async getFeed(db: DbClient, input: NotificationsFeedInput, userId: string) {
    const { cursor, isRead, limit, type } = input;

    try {
      const items = await db.notification.findMany({
        cursor: cursor != null ? { id: cursor } : undefined,
        include: { repo: { select: { name: true, owner: true } } },
        orderBy: ORDER_CREATED_AT_DESC,
        take: limit + 1,
        where: {
          userId,
          ...(isRead == null ? {} : { isRead }),
          ...(type == null ? {} : { type }),
        },
      });

      const hasNextPage = items.length > limit;
      if (hasNextPage) {
        items.pop();
      }

      return {
        items: items.map((item) => notificationMapper.toPublic(item)),
        meta: { hasNextPage, nextCursor: hasNextPage ? items.at(-1)?.id : undefined },
      };
    } catch (error) {
      handlePrismaError(error);
    }
  },

  async getStats(db: DbClient, userId: string) {
    try {
      const groups = await db.notification.groupBy({
        _count: { _all: true },
        by: ["isRead"],
        where: { userId },
      });

      const read = groups.find((g) => g.isRead)?._count._all ?? 0;
      const unread = groups.find((g) => !g.isRead)?._count._all ?? 0;

      return { read, total: read + unread, unread };
    } catch (error) {
      handlePrismaError(error);
    }
  },

  async markAllAsRead(db: DbClient, input: NotificationsBulkFilterInput, userId: string) {
    const where = this.buildWhereClause(input, userId);

    try {
      const result = await db.notification.updateMany({
        data: { isRead: true },
        where: { ...where, isRead: false },
      });

      const updatedCount = result.count;

      void realtimeService
        .user(userId)
        .publish(REALTIME_CONFIG.events.user.notificationUpdated, {});

      return { success: true, updatedCount };
    } catch (error) {
      handlePrismaError(error);
    }
  },

  async markAs(db: DbClient, id: string, isRead: boolean, userId: string) {
    try {
      await db.notification.update({ data: { isRead }, where: { id, userId } });

      void realtimeService
        .user(userId)
        .publish(REALTIME_CONFIG.events.user.notificationUpdated, {});

      return { success: true };
    } catch (error) {
      handlePrismaError(error, { notFound: "Notification not found" });
    }
  },
};
