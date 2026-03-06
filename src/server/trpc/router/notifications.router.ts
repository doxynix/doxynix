import { z } from "zod";

import { notificationsService } from "@/server/services/notifications.service";
import { handlePrismaError } from "@/server/utils/handle-prisma-error";
import { NotificationSchema } from "@/generated/zod";

import { NotificationsFilterSchema, OpenApiErrorResponses } from "../shared";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const NotificationsPublicSchema = NotificationSchema.extend({
  id: z.string(),
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
        description: "Deleted one notification.",
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
        description: "Deleted all read notifications.",
        errorResponses: OpenApiErrorResponses,
        method: "DELETE",
        path: "/notifications",
        protect: true,
        summary: "Delete read notifications",
        tags: ["notifications"],
      },
    })
    .input(NotificationsFilterSchema.omit({ cursor: true, limit: true }).partial())
    .output(z.object({ message: z.string(), success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const { isRead, repoName, repoOwner, search, type } = input;
      const where = notificationsService.buildWhereClause({
        isRead,
        repoName,
        repoOwner,
        search,
        type,
      });

      try {
        await ctx.db.notification.deleteMany({
          where: { ...where, isRead: true },
        });
        return { message: "All readed notifications was deleted", success: true };
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
        meta: z.object({
          currentPage: z.number().int(),
          filteredCount: z.number().int(),
          nextCursor: z.number().int().optional(),
          pageSize: z.number().int(),
          searchQuery: z.string().optional(),
          totalCount: z.number().int(),
          totalPages: z.number().int(),
        }),
      })
    )
    .query(async ({ ctx, input }) => {
      const { cursor, isRead, limit, repoName, repoOwner, search, type } = input;
      const page = Math.min(Math.max(1, cursor ?? 1), 1000000);
      const where = notificationsService.buildWhereClause({
        isRead,
        repoName,
        repoOwner,
        search,
        type,
      });

      const [items, totalCount, filteredCount] = await Promise.all([
        ctx.db.notification.findMany({
          include: { repo: true },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
          where,
        }),
        ctx.db.notification.count(),
        ctx.db.notification.count({ where }),
      ]);

      const totalPages = Math.ceil(filteredCount / limit);

      return {
        items: items.map((n) => ({
          ...n,
          id: n.publicId,
          repo: n.repo ? { name: n.repo.name, owner: n.repo.owner } : null,
        })),
        meta: {
          currentPage: page,
          filteredCount,
          nextCursor: page < totalPages ? page + 1 : undefined,
          pageSize: limit,
          searchQuery: search,
          totalCount,
          totalPages,
        },
      };
    }),

  getStats: protectedProcedure
    .output(
      z.object({
        read: z.number().int(),
        total: z.number().int(),
        unread: z.number().int(),
      })
    )
    .query(async ({ ctx }) => {
      const groups = await ctx.db.notification.groupBy({
        _count: { _all: true },
        by: ["isRead"],
      });

      return groups.reduce(
        (acc, group) => {
          if (group.isRead) acc.read = group._count._all;
          else acc.unread = group._count._all;
          acc.total += group._count._all;
          return acc;
        },
        { read: 0, total: 0, unread: 0 }
      );
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
    .input(NotificationsFilterSchema.omit({ cursor: true, limit: true }).partial())
    .output(
      z.object({
        message: z.string(),
        success: z.boolean(),
        updatedCount: z.number().int(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { isRead, repoName, repoOwner, search, type } = input;
      const where = notificationsService.buildWhereClause({
        isRead,
        repoName,
        repoOwner,
        search,
        type,
      });

      try {
        const result = await ctx.db.notification.updateMany({
          data: {
            isRead: true,
          },
          where: {
            ...where,
            isRead: false,
          },
        });

        return {
          message: `Marked ${result.count} notifications as read`,
          success: true,
          updatedCount: result.count,
        };
      } catch (error) {
        handlePrismaError(error);
      }
    }),

  markAs: protectedProcedure
    .meta({
      openapi: {
        description: "Marks a specific notification as read using its public identifier.",
        errorResponses: OpenApiErrorResponses,
        method: "PATCH",
        path: "/notifications/{id}",
        protect: true,
        summary: "Mark notification as read",
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
        return { message: "Marked as read", success: true };
      } catch (error) {
        handlePrismaError(error, { notFound: "Notification not found" });
      }
    }),
});
