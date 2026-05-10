import type { Prisma } from "@prisma/client";
import z from "zod";

import { OpenApiErrorResponses } from "@/server/core/trpc/constants";
import { createTRPCRouter, protectedProcedure } from "@/server/core/trpc/init";
import { handlePrismaError } from "@/server/utils/handle-error";
import {
  getPaginationMeta,
  PaginationMetaSchema,
  type PaginationMeta,
} from "@/server/utils/pagination";

import { NotificationsBulkFilterSchema, NotificationsFilterSchema } from "./notification.schemas";
import { notificationsService } from "./notifications.service";
import { NotificationSchema } from "@/shared/api-contracts";

const NotificationsPublicSchema = NotificationSchema.extend({
  id: z.uuid(),
  repo: z
    .object({
      name: z.string(),
      owner: z.string(),
    })
    .nullable(),
});

export const notificationRouter = createTRPCRouter({
  deleteOne: protectedProcedure
    .meta({
      openapi: {
        description: "Deletes one notification.",
        errorResponses: OpenApiErrorResponses,
        method: "DELETE",
        path: "/notifications/{id}",
        protect: true,
        summary: "Delete one notification",
        tags: ["notifications"],
      },
    })
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ message: z.string(), success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.notification.delete({
          where: { publicId: input.id },
        });

        return { message: "Notification deleted", success: true };
      } catch (error) {
        handlePrismaError(error, { notFound: "Notification not found" });
      }
    }),

  deleteRead: protectedProcedure
    .meta({
      openapi: {
        description: "Deletes all read notifications.",
        errorResponses: OpenApiErrorResponses,
        method: "DELETE",
        path: "/notifications",
        protect: true,
        summary: "Delete read notifications",
        tags: ["notifications"],
      },
    })
    .input(NotificationsBulkFilterSchema)
    .output(
      z.object({
        deletedCount: z.number().int().min(0),
        message: z.string(),
        success: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const where = notificationsService.buildWhereClause(input);

      try {
        const result = await ctx.db.notification.deleteMany({
          where: { ...where, isRead: true },
        });
        return {
          deletedCount: result.count,
          message: `Deleted ${result.count} read notifications`,
          success: true,
        };
      } catch (error) {
        handlePrismaError(error, { notFound: "Notification not found" });
      }
    }),

  getAll: protectedProcedure
    .meta({
      openapi: {
        description:
          "Returns the latest notifications for the authenticated user ordered by creation date.",
        errorResponses: OpenApiErrorResponses,
        method: "GET",
        path: "/notifications",
        protect: true,
        summary: "Get latest notifications",
        tags: ["notifications"],
      },
    })
    .input(NotificationsFilterSchema)
    .output(
      z.object({
        items: z.array(NotificationsPublicSchema),
        meta: PaginationMetaSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      const { cursor, isRead, limit, repoName, repoOwner, search, type } = input;

      const page = Math.min(Math.max(1, cursor ?? 1), 1_000_000);
      const skip = (page - 1) * limit;

      const where = notificationsService.buildWhereClause({
        isRead,
        repoName,
        repoOwner,
        search,
        type,
      });

      const [items, totalCount, filteredCount] = await Promise.all([
        ctx.db.notification.findMany({
          include: { repo: { select: { name: true, owner: true } } },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip,
          take: limit,
          where,
        }),
        ctx.db.notification.count(),
        ctx.db.notification.count({ where }),
      ]);

      const meta = getPaginationMeta({
        filteredCount,
        limit,
        page,
        search: search ?? undefined,
        totalCount,
      });

      return notificationMapper.toPaginatedList(items as NotificationWithRepo[], meta);
    }),

  getStats: protectedProcedure
    .meta({
      openapi: {
        description:
          "Returns notification statistics (total, read, unread) for the authenticated user.",
        errorResponses: OpenApiErrorResponses,
        method: "GET",
        path: "/notifications/stats",
        protect: true,
        summary: "Get notification stats",
        tags: ["notifications"],
      },
    })
    .input(z.object({}).optional())
    .output(
      z.object({
        read: z.number().int(),
        total: z.number().int(),
        unread: z.number().int(),
      })
    )
    .query(async ({ ctx }) => {
      try {
        const groups = await ctx.db.notification.groupBy({
          _count: { _all: true },
          by: ["isRead"],
        });

        const read = groups.find((g) => g.isRead === true)?._count._all ?? 0;
        const unread = groups.find((g) => g.isRead === false)?._count._all ?? 0;

        return {
          read,
          total: read + unread,
          unread,
        };
      } catch (error) {
        handlePrismaError(error);
      }
    }),

  markAllAsRead: protectedProcedure
    .meta({
      openapi: {
        description: "Marks all unread notifications for the authenticated user as read.",
        errorResponses: OpenApiErrorResponses,
        method: "PATCH",
        path: "/notifications",
        protect: true,
        summary: "Mark all notifications as read",
        tags: ["notifications"],
      },
    })
    .input(NotificationsBulkFilterSchema)
    .output(
      z.object({
        message: z.string(),
        success: z.boolean(),
        updatedCount: z.number().int(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const where = notificationsService.buildWhereClause(input);

      try {
        const result = await ctx.db.notification.updateMany({
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
    }),

  markAs: protectedProcedure
    .meta({
      openapi: {
        description:
          "Updates the read state of a specific notification using its public identifier.",
        errorResponses: OpenApiErrorResponses,
        method: "PATCH",
        path: "/notifications/{id}",
        protect: true,
        summary: "Update notification read state",
        tags: ["notifications"],
      },
    })
    .input(z.object({ id: z.uuid(), isRead: z.boolean() }))
    .output(z.object({ message: z.string(), success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.notification.update({
          data: { isRead: input.isRead },
          where: { publicId: input.id },
        });
        return { message: input.isRead ? "Marked as read" : "Marked as unread", success: true };
      } catch (error) {
        handlePrismaError(error, { notFound: "Notification not found" });
      }
    }),
});

type NotificationWithRepo = Prisma.NotificationGetPayload<{
  include: {
    repo: {
      select: {
        name: true;
        owner: true;
      };
    };
  };
}>;

export const notificationMapper = {
  toPaginatedList(items: NotificationWithRepo[], meta: PaginationMeta) {
    return {
      items: items.map((item) => this.toPublic(item)),
      meta,
    };
  },

  toPublic(n: NotificationWithRepo) {
    return {
      ...n,
      id: n.publicId,
      repo: n.repo != null ? { name: n.repo.name, owner: n.repo.owner } : null,
    };
  },
};
