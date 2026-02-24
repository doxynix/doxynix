import { z } from "zod";

import { handlePrismaError } from "@/server/utils/handle-prisma-error";
import { NotificationSchema } from "@/generated/zod";

import { OpenApiErrorResponses } from "../shared";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const NotificationsPublicSchema = NotificationSchema.extend({
  id: z.string(),
});

export const notificationRouter = createTRPCRouter({
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
    .input(z.object({ count: z.number().int().min(1).max(10000) }))
    .output(z.array(NotificationsPublicSchema))
    .query(async ({ ctx, input }) => {
      const notifications = await ctx.db.notification.findMany({
        orderBy: { createdAt: "desc" },
        take: input.count,
      });

      return notifications.map((n) => ({
        ...n,
        id: n.publicId,
      }));
    }),

  getUnreadCount: protectedProcedure
    .meta({
      openapi: {
        description: "Returns the number of unread notifications for the authenticated user.",
        errorResponses: OpenApiErrorResponses,
        method: "GET",
        path: "/notifications/unread-count",
        protect: true,
        summary: "Get unread notifications count",
        tags: ["notifications"],
      },
    })
    .input(z.void())
    .output(z.object({ count: z.number().int() }))
    .query(async ({ ctx }) => {
      const count = await ctx.db.notification.count({
        where: { isRead: false },
      });

      return { count };
    }),

  markAllAsRead: protectedProcedure
    .meta({
      openapi: {
        description: "Marks all unread notifications for the authenticated user as read.",
        errorResponses: OpenApiErrorResponses,
        method: "PATCH",
        path: "/notifications/read-all",
        protect: true,
        summary: "Mark all notifications as read",
        tags: ["notifications"],
      },
    })
    .input(z.void())
    .output(
      z.object({
        message: z.string(),
        success: z.boolean(),
        updatedCount: z.number().int(),
      })
    )
    .mutation(async ({ ctx }) => {
      try {
        const result = await ctx.db.notification.updateMany({
          data: {
            isRead: true,
          },
          where: {
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

  markAsRead: protectedProcedure
    .meta({
      openapi: {
        description: "Marks a specific notification as read using its public identifier.",
        errorResponses: OpenApiErrorResponses,
        method: "PATCH",
        path: "/notifications/{id}/read",
        protect: true,
        summary: "Mark notification as read",
        tags: ["notifications"],
      },
    })
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ message: z.string(), success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.notification.update({
          data: { isRead: true },
          where: { publicId: input.id },
        });
        return { message: "Marked as read", success: true };
      } catch (error) {
        handlePrismaError(error, { notFound: "Notification not found" });
      }
    }),
});
