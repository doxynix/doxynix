import { ApiKeySchema, CreateApiKeySchema, UpdateApiKeySchema } from "@doxynix/shared";
import * as z from "zod/mini";

import { createTRPCRouter, protectedProcedure } from "@/server/core/trpc/init";

import { apiKeyService } from "./api-key.service";

export const apiKeyRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      CreateApiKeySchema.check(
        z.refine((data) => data.expiresAt == null || data.expiresAt.getTime() > Date.now(), {
          error: "Expiry must be in the future",
        }),
      ),
    )
    .output(z.object({ key: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return apiKeyService.create(ctx.db, ctx.session.user.id, input);
    }),

  list: protectedProcedure
    .input(z.optional(z.object({})))
    .output(z.object({ active: z.array(ApiKeySchema), archived: z.array(ApiKeySchema) }))
    .query(async ({ ctx }) => {
      return apiKeyService.list(ctx.db, ctx.session.user.id);
    }),

  revoke: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return apiKeyService.revoke(ctx.db, input.id, ctx.session.user.id);
    }),

  rotate: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ gracePeriodDays: z.number(), id: z.uuid(), key: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return apiKeyService.rotate(ctx.db, input.id, ctx.session.user.id);
    }),

  touch: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return apiKeyService.touch(ctx.db, input.id, ctx.session.user.id);
    }),

  update: protectedProcedure
    .input(
      z.extend(UpdateApiKeySchema, { id: z.uuid() }).check(
        z.refine((data) => data.scopes == null || data.scopes.length > 0, {
          error: "Select at least one permission",
        }),
      ),
    )
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return apiKeyService.update(ctx.db, input, ctx.session.user.id);
    }),
});
