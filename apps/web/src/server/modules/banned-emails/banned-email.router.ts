import * as z from "zod";

import { adminProcedure, createTRPCRouter } from "@/server/core/trpc/init";

import {
  BannedEmailCreateSchema,
  BannedEmailFilterSchema,
  BannedEmailListSchema,
  BannedEmailRefSchema,
  BannedEmailSchema,
} from "./banned-email.schemas";
import { bannedEmailService } from "./banned-email.service";

export const bannedEmailRouter = createTRPCRouter({
  create: adminProcedure
    .input(BannedEmailCreateSchema)
    .output(BannedEmailSchema)
    .mutation(async ({ ctx, input }) => {
      return bannedEmailService.create(ctx.db, input);
    }),

  list: adminProcedure
    .input(BannedEmailFilterSchema)
    .output(BannedEmailListSchema)
    .query(async ({ ctx, input }) => {
      return bannedEmailService.getAll(ctx.db, input);
    }),

  remove: adminProcedure
    .input(BannedEmailRefSchema)
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return bannedEmailService.remove(ctx.db, input.id);
    }),
});
