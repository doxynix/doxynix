import { z } from "zod";

import { CreateApiKeySchema } from "@/shared/api/schemas/api-key";

import { apiKeyService } from "@/server/services/api-key.service";
import { ApiKeySchema } from "@/generated/zod";

import { OpenApiErrorResponses } from "../contracts";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const apiKeyRouter = createTRPCRouter({
  create: protectedProcedure
    .meta({
      openapi: {
        description: "Generates a new API Key. The full key is shown only once.",
        errorResponses: OpenApiErrorResponses,
        method: "POST",
        path: "/api-keys",
        protect: true,
        summary: "Create API Key",
        tags: ["api-keys"],
      },
    })
    .input(CreateApiKeySchema)
    .output(z.object({ key: z.string(), message: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return apiKeyService.create(ctx.db, Number(ctx.session.user.id), input);
    }),

  list: protectedProcedure
    .meta({
      openapi: {
        description: "Returns all active and revoked API keys for the current user.",
        errorResponses: OpenApiErrorResponses,
        method: "GET",
        path: "/api-keys",
        protect: true,
        summary: "List API Keys",
        tags: ["api-keys"],
      },
    })
    .input(z.void())
    .output(
      z.object({
        active: z.array(ApiKeySchema),
        archived: z.array(ApiKeySchema),
      })
    )
    .query(async ({ ctx }) => {
      return apiKeyService.list(ctx.db);
    }),

  revoke: protectedProcedure
    .meta({
      openapi: {
        description: "Permanently revokes an API key. It can no longer be used for authentication.",
        errorResponses: OpenApiErrorResponses,
        method: "DELETE",
        path: "/api-keys/{id}",
        protect: true,
        summary: "Revoke API Key",
        tags: ["api-keys"],
      },
    })
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ message: z.string(), success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return apiKeyService.revoke(ctx.db, input.id);
    }),

  touch: protectedProcedure
    .meta({
      openapi: {
        description: "Updates the lastUsed timestamp for the specified API key.",
        errorResponses: OpenApiErrorResponses,
        method: "PATCH",
        path: "/api-keys/{id}/touch",
        protect: true,
        summary: "Touch API Key",
        tags: ["api-keys"],
      },
    })
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return apiKeyService.touch(ctx.db, input.id);
    }),

  update: protectedProcedure
    .meta({
      openapi: {
        description: "Updates the name or description of an existing API key.",
        errorResponses: OpenApiErrorResponses,
        method: "PATCH",
        path: "/api-keys/{id}",
        protect: true,
        summary: "Update API Key",
        tags: ["api-keys"],
      },
    })
    .input(z.intersection(CreateApiKeySchema, z.object({ id: z.uuid() })))
    .output(z.object({ message: z.string(), success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return apiKeyService.update(ctx.db, input.id, input);
    }),
});
