import { ApiKeySchema, CreateApiKeySchema, UpdateApiKeySchema } from "@doxynix/shared";
import * as z from "zod/mini";

import { createTRPCRouter, workspaceProcedure } from "@/server/core/trpc/init";

import { apiKeyService } from "./api-key.service";

export const apiKeyRouter = createTRPCRouter({
  create: workspaceProcedure
    .input(
      CreateApiKeySchema.check(
        z.refine((data) => data.expiresAt == null || data.expiresAt.getTime() > Date.now(), {
          error: "Expiry must be in the future",
        }),
      ),
    )
    .output(z.object({ key: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return apiKeyService.create(ctx.db, ctx.session.user.id, ctx.workspace.id, input);
    }),

  list: workspaceProcedure
    .input(z.optional(z.object({})))
    .output(z.object({ active: z.array(ApiKeySchema), archived: z.array(ApiKeySchema) }))
    .query(async ({ ctx }) => {
      return apiKeyService.list(ctx.db, ctx.workspace.id);
    }),

  revoke: workspaceProcedure
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return apiKeyService.revoke(ctx.db, input.id, ctx.session.user.id, ctx.workspace.id);
    }),

  rotate: workspaceProcedure
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ gracePeriodDays: z.number(), id: z.uuid(), key: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return apiKeyService.rotate(ctx.db, input.id, ctx.session.user.id, ctx.workspace.id);
    }),

  touch: workspaceProcedure
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return apiKeyService.touch(ctx.db, input.id, ctx.session.user.id, ctx.workspace.id);
    }),

  update: workspaceProcedure
    .input(
      z.extend(UpdateApiKeySchema, { id: z.uuid() }).check(
        z.refine((data) => data.scopes == null || data.scopes.length > 0, {
          error: "Select at least one permission",
        }),
      ),
    )
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return apiKeyService.update(ctx.db, input, ctx.session.user.id, ctx.workspace.id);
    }),
});
