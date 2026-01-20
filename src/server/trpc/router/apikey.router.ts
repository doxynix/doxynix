import crypto from "crypto";
import { z } from "zod";

import { CreateApiKeySchema } from "@/shared/api/schemas/api-key";

import { ApiKeySchema } from "@/generated/zod";
import { OpenApiErrorResponses } from "@/server/trpc/shared";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc/trpc";
import { handlePrismaError } from "@/server/utils/handlePrismaError";

export const PublicApiKeySchema = ApiKeySchema.omit({
  userId: true,
  hashedKey: true,
});

const BRAND_PREFIX = "dxnx_";

export const apiKeyRouter = createTRPCRouter({
  create: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/api-keys",
        tags: ["api-keys"],
        summary: "Create API Key",
        description: "Generates a new API Key. The full key is shown only once.",
        protect: true,
        errorResponses: OpenApiErrorResponses,
      },
    })
    .input(CreateApiKeySchema)
    .output(z.object({ key: z.string(), message: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const userId = Number(ctx.session.user.id);
      const randomPart = crypto.randomBytes(32).toString("hex");
      const fullKey = `${BRAND_PREFIX}${randomPart}`;
      const displayPrefix = `${BRAND_PREFIX}${randomPart.slice(0, 6)}`;
      const hashedKey = crypto.createHash("sha256").update(fullKey).digest("hex");

      try {
        await ctx.db.apiKey.create({
          data: {
            userId,
            name: input.name,
            description: input.description,
            prefix: displayPrefix,
            hashedKey,
          },
        });
      } catch (error) {
        handlePrismaError(error, {
          uniqueConstraint: {
            name: "API Key with this name already exists",
            hashedKey: "Incredible, but a duplicate key was generated. Try again.",
          },
          defaultConflict: "API Key with this name already exists",
        });
      }

      return { key: fullKey, message: "API Key created" };
    }),

  list: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api-keys",
        tags: ["api-keys"],
        summary: "List API Keys",
        description: "Returns all active and revoked API keys for the current user.",
        protect: true,
        errorResponses: OpenApiErrorResponses,
      },
    })
    .input(z.void())
    .output(
      z.object({
        active: z.array(PublicApiKeySchema),
        archived: z.array(PublicApiKeySchema),
      })
    )
    .query(async ({ ctx }) => {
      const allKeys = await ctx.db.apiKey.findMany({
        where: {
          OR: [{ revoked: true }, { revoked: false }],
        },
        orderBy: { createdAt: "desc" },
      });

      return {
        active: allKeys.filter((k) => k.revoked !== true),
        archived: allKeys.filter((k) => k.revoked),
      };
    }),

  update: protectedProcedure
    .meta({
      openapi: {
        method: "PATCH",
        path: "/api-keys/{id}",
        tags: ["api-keys"],
        summary: "Update API Key",
        description: "Updates the name or description of an existing API key.",
        protect: true,
        errorResponses: OpenApiErrorResponses,
      },
    })
    .input(
      CreateApiKeySchema.extend({
        id: z.uuid(),
      })
    )
    .output(z.object({ success: z.boolean(), message: z.string() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const data = await ctx.db.apiKey.updateMany({
          where: { id: input.id },
          data: { name: input.name, description: input.description },
        });

        if (data.count === 0) {
          throw new Error("Key not found or access denied");
        }

        return { success: true, message: "API Key data updated" };
      } catch (error) {
        handlePrismaError(error, {
          uniqueConstraint: { name: "Name already taken" },
          notFound: "Key not found or access denied",
          defaultConflict: "API Key with this name already exists",
        });
      }
    }),

  revoke: protectedProcedure
    .meta({
      openapi: {
        method: "DELETE",
        path: "/api-keys/{id}",
        tags: ["api-keys"],
        summary: "Revoke API Key",
        description: "Permanently revokes an API key. It can no longer be used for authentication.",
        protect: true,
        errorResponses: OpenApiErrorResponses,
      },
    })
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ success: z.boolean(), message: z.string() }))
    .mutation(async ({ input, ctx }) => {
      try {
        await ctx.db.apiKey.delete({
          where: { id: input.id },
        });

        return { success: true, message: "API Key revoked" };
      } catch (error) {
        handlePrismaError(error, { notFound: "Key not found" });
      }
    }),

  touch: protectedProcedure
    .meta({
      openapi: {
        method: "PATCH",
        path: "/api-keys/{id}/touch",
        tags: ["api-keys"],
        summary: "Touch API Key",
        description: "Updates the lastUsed timestamp for the specified API key.",
        protect: true,
        errorResponses: OpenApiErrorResponses,
      },
    })
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      try {
        await ctx.db.apiKey.updateMany({
          where: { id: input.id },
          data: { lastUsed: new Date() },
        });

        return { success: true };
      } catch (error) {
        handlePrismaError(error);
      }
    }),
});
