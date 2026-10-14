import { NotificationSchema, PaginationMetaSchema } from "@doxynix/shared";
import * as z from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/core/trpc/init";

import {
  NotificationsBulkFilterSchema,
  NotificationsFeedOutputSchema,
  NotificationsFeedSchema,
  NotificationsFilterSchema,
} from "./notification.schemas";
import { notificationsService } from "./notifications.service";

export const notificationRouter = createTRPCRouter({
  deleteOne: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return notificationsService.deleteOne(ctx.db, input.id, ctx.session.user.id);
    }),

  deleteRead: protectedProcedure
    .input(NotificationsBulkFilterSchema)
    .output(
      z.object({
        deletedCount: z.number().int().min(0),
        success: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return notificationsService.deleteRead(ctx.db, input, ctx.session.user.id);
    }),

  getAll: protectedProcedure
    .input(NotificationsFilterSchema)
    .output(z.object({ items: z.array(NotificationSchema), meta: PaginationMetaSchema }))
    .query(async ({ ctx, input }) => {
      return notificationsService.getAll(ctx.db, input, ctx.session.user.id);
    }),

  getFeed: protectedProcedure
    .input(NotificationsFeedSchema)
    .output(NotificationsFeedOutputSchema)
    .query(async ({ ctx, input }) => {
      return notificationsService.getFeed(ctx.db, input, ctx.session.user.id);
    }),

  getStats: protectedProcedure
    .input(z.object({}).optional())
    .output(z.object({ read: z.number().int(), total: z.number().int(), unread: z.number().int() }))
    .query(async ({ ctx }) => {
      return notificationsService.getStats(ctx.db, ctx.session.user.id);
    }),

  markAllAsRead: protectedProcedure
    .input(NotificationsBulkFilterSchema)
    .output(
      z.object({
        success: z.boolean(),
        updatedCount: z.number().int(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return notificationsService.markAllAsRead(ctx.db, input, ctx.session.user.id);
    }),

  markAs: protectedProcedure
    .input(z.object({ id: z.uuid(), isRead: z.boolean() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return notificationsService.markAs(ctx.db, input.id, input.isRead, ctx.session.user.id);
    }),
});
