import { ApiKeySchema, CreateApiKeySchema } from "@doxynix/shared";
import * as z from "zod/mini";

import { createTRPCRouter, protectedProcedure } from "@/server/core/trpc/init";

import { apiKeyService } from "./api-key.service";

export const apiKeyRouter = createTRPCRouter({
  create: protectedProcedure
    .input(CreateApiKeySchema)
    .output(z.object({ key: z.string(), message: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return apiKeyService.create(ctx.db, Number(ctx.session.user.id), input);
    }),

  list: protectedProcedure
    .input(z.optional(z.object({})))
    .output(z.object({ active: z.array(ApiKeySchema), archived: z.array(ApiKeySchema) }))
    .query(async ({ ctx }) => {
      return apiKeyService.list(ctx.db);
    }),

  revoke: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ message: z.string(), success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return apiKeyService.revoke(ctx.db, input.id);
    }),

  touch: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return apiKeyService.touch(ctx.db, input.id);
    }),

  update: protectedProcedure
    .input(z.extend(CreateApiKeySchema, { id: z.uuid() }))
    .output(z.object({ message: z.string(), success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return apiKeyService.update(ctx.db, input);
    }),
});
