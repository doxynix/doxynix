import { z } from "zod";

import { NotificationSchema } from "@/generated/zod";
import { handlePrismaError } from "@/server/utils/handle-prisma-error";
import { OpenApiErrorResponses } from "../shared";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const NotificationsPublicSchema = NotificationSchema.extend({
  id: z.string(),
}).omit({ publicId: true, userId: true });

export const notificationRouter = createTRPCRouter({
  getAll: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/notifications",
        tags: ["notifications"],
        summary: "Get latest notifications",
        description:
          "Returns the latest notifications for the authenticated user ordered by creation date.",
        protect: true,
        errorResponses: OpenApiErrorResponses,
      },
    })
    .input(z.object({ count: z.number().int().min(1).max(10000) }))
    .output(z.array(NotificationsPublicSchema))
    .query(async ({ ctx, input }) => {
      const userId = Number(ctx.session.user.id);

      const notifications = await ctx.db.notification.findMany({
        where: { userId },
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
        method: "GET",
        path: "/notifications/unread-count",
        tags: ["notifications"],
        summary: "Get unread notifications count",
        description: "Returns the number of unread notifications for the authenticated user.",
        protect: true,
        errorResponses: OpenApiErrorResponses,
      },
    })
    .input(z.void())
    .output(z.object({ count: z.number().int() }))
    .query(async ({ ctx }) => {
      const userId = Number(ctx.session.user.id);

      const count = await ctx.db.notification.count({
        where: { userId, isRead: false },
      });

      return { count };
    }),

  markAsRead: protectedProcedure
    .meta({
      openapi: {
        method: "PATCH",
        path: "/notifications/{id}/read",
        tags: ["notifications"],
        summary: "Mark notification as read",
        description: "Marks a specific notification as read using its public identifier.",
        protect: true,
        errorResponses: OpenApiErrorResponses,
      },
    })
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ success: z.boolean(), message: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.notification.update({
          where: { publicId: input.id },
          data: { isRead: true },
        });
        return { success: true, message: "Marked as read" };
      } catch (error) {
        handlePrismaError(error, { notFound: "Notification not found" });
      }
    }),

  markAllAsRead: protectedProcedure
    .meta({
      openapi: {
        method: "PATCH",
        path: "/notifications/read-all",
        tags: ["notifications"],
        summary: "Mark all notifications as read",
        description: "Marks all unread notifications for the authenticated user as read.",
        protect: true,
        errorResponses: OpenApiErrorResponses,
      },
    })
    .input(z.void())
    .output(
      z.object({
        success: z.boolean(),
        updatedCount: z.number().int(),
        message: z.string(),
      })
    )
    .mutation(async ({ ctx }) => {
      const userId = Number(ctx.session.user.id);

      try {
        const result = await ctx.db.notification.updateMany({
          where: {
            userId,
            isRead: false,
          },
          data: {
            isRead: true,
          },
        });

        return {
          success: true,
          updatedCount: result.count,
          message: `Marked ${result.count} notifications as read`,
        };
      } catch (error) {
        handlePrismaError(error);
      }
    }),
});
