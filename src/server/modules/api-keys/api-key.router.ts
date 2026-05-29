import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { ApiKeySchema } from "@/shared/api-contracts";
import { CreateApiKeySchema } from "@/shared/api/schemas/api-key";

import { OpenApiErrorResponses } from "@/server/core/trpc/constants";
import { createTRPCRouter, protectedProcedure } from "@/server/core/trpc/init";
import { handlePrismaError } from "@/server/utils/handle-error";
import { extractPayloadFromKey, generateApiKey, getApiKeyHash } from "@/server/utils/hash";

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
      const fullKey = generateApiKey();

      const displayPrefix = fullKey.slice(0, 11);

      const payload = extractPayloadFromKey(fullKey);

      if (payload == null) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to process and validate generated API key integrity.",
        });
      }

      const hashedKey = getApiKeyHash(payload);

      try {
        await ctx.db.apiKey.create({
          data: {
            description: input.description,
            hashedKey,
            name: input.name,
            prefix: displayPrefix,
            userId: Number(ctx.session.user.id),
          },
        });
      } catch (error) {
        handlePrismaError(error, {
          defaultConflict: "API Key with this name already exists",
          uniqueConstraint: {
            hashedKey: "Incredible, but a duplicate key was generated. Try again.",
            name: "API Key with this name already exists",
          },
        });
      }

      return { key: fullKey, message: "API Key created" };
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
    .input(z.object({}).optional())
    .output(
      z.object({
        active: z.array(ApiKeySchema),
        archived: z.array(ApiKeySchema),
      })
    )
    .query(async ({ ctx }) => {
      const allKeys = await ctx.db.apiKey.findMany({
        orderBy: { createdAt: "desc" },
        where: {
          OR: [{ revoked: true }, { revoked: false }],
        },
      });

      return {
        active: allKeys.filter((k) => k.revoked === false),
        archived: allKeys.filter((k) => k.revoked),
      };
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
      try {
        await ctx.db.apiKey.update({
          data: { revoked: true },
          where: { id: input.id },
        });

        return { message: "API Key revoked", success: true };
      } catch (error) {
        handlePrismaError(error, { notFound: "Key not found" });
      }
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
      const result = await ctx.db.apiKey
        .updateMany({
          data: { lastUsed: new Date() },
          where: { id: input.id },
        })
        .catch((error) => {
          handlePrismaError(error);
        });

      if (result.count === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "API Key not found or access denied",
        });
      }

      return { success: true };
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
    .input(CreateApiKeySchema.extend({ id: z.uuid() }))
    .output(z.object({ message: z.string(), success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const data = await ctx.db.apiKey.updateMany({
          data: { description: input.description, name: input.name },
          where: { id: input.id },
        });

        if (data.count === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Key not found or access denied",
          });
        }

        return { message: "API Key data updated", success: true };
      } catch (error) {
        handlePrismaError(error, {
          defaultConflict: "API Key with this name already exists",
          notFound: "Key not found or access denied",
          uniqueConstraint: { name: "Name already taken" },
        });
      }
    }),
});
