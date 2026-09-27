import { NotificationSchema, PaginationMetaSchema } from "@doxynix/shared";
import * as z from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/core/trpc/init";

import { NotificationsBulkFilterSchema, NotificationsFilterSchema } from "./notification.schemas";
import { notificationsService } from "./notifications.service";

export const notificationRouter = createTRPCRouter({
  deleteOne: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ message: z.string(), success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return notificationsService.deleteOne(ctx.db, input.id);
    }),

  deleteRead: protectedProcedure
    .input(NotificationsBulkFilterSchema)
    .output(
      z.object({
        deletedCount: z.number().int().min(0),
        message: z.string(),
        success: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return notificationsService.deleteRead(ctx.db, input);
    }),

  getAll: protectedProcedure
    .input(NotificationsFilterSchema)
    .output(z.object({ items: z.array(NotificationSchema), meta: PaginationMetaSchema }))
    .query(async ({ ctx, input }) => {
      return notificationsService.getAll(ctx.db, input);
    }),

  getStats: protectedProcedure
    .input(z.object({}).optional())
    .output(z.object({ read: z.number().int(), total: z.number().int(), unread: z.number().int() }))
    .query(async ({ ctx }) => {
      return notificationsService.getStats(ctx.db);
    }),

  markAllAsRead: protectedProcedure
    .input(NotificationsBulkFilterSchema)
    .output(
      z.object({
        message: z.string(),
        success: z.boolean(),
        updatedCount: z.number().int(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return notificationsService.markAllAsRead(ctx.db, input);
    }),

  markAs: protectedProcedure
    .input(z.object({ id: z.uuid(), isRead: z.boolean() }))
    .output(z.object({ message: z.string(), success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return notificationsService.markAs(ctx.db, input.id, input.isRead);
    }),
});
