import { z } from "zod";

import { notificationsService } from "@/server/entities/notification/api/notifications.service";
import { PaginationMetaSchema } from "@/server/shared/lib/pagination";
import { NotificationSchema } from "@/generated/zod";

import {
  NotificationsBulkFilterSchema,
  NotificationsFilterSchema,
  OpenApiErrorResponses,
} from "../contracts";
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
      return notificationsService.deleteOne(ctx.db, input.id);
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
      return notificationsService.deleteRead(ctx.db, input);
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
      return notificationsService.getAll(ctx.db, input);
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
    .output(
      z.object({
        read: z.number().int(),
        total: z.number().int(),
        unread: z.number().int(),
      })
    )
    .query(async ({ ctx }) => {
      return notificationsService.getStats(ctx.db);
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
      return notificationsService.markAllAsRead(ctx.db, input);
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
      return notificationsService.markAs(ctx.db, input.id, input.isRead);
    }),
});
