import crypto from "crypto";
import { z } from "zod";

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
    .input(
      z.object({
        name: z
          .string()
          .trim()
          .min(1, "Слишком короткое имя (мин 1 символ)")
          .max(50, "Слишком длинное название (макс 50)"),
        description: z.string().trim().max(1000, "Слишком длинное описание").optional(),
      })
    )
    .output(z.object({ key: z.string(), message: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const userId = Number(ctx.session.user.id);
      const randomPart = crypto.randomBytes(32).toString("hex");
      const fullKey = `${BRAND_PREFIX}${randomPart}`;
      const displayPrefix = randomPart.slice(0, 6);
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
            name: "API-ключ с таким именем уже существует",
            hashedKey: "Невероятно, но сгенерировался дубликат ключа. Попробуйте снова.",
          },
          defaultConflict: "API-ключ с таким именем уже существует",
        });
      }

      return { key: fullKey, message: "API-ключ создан" };
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
      z.object({
        id: z.uuid(),
        name: z
          .string()
          .trim()
          .min(1, "Слишком короткое имя (мин 1 символ)")
          .max(50, "Слишком длинное имя (макс 50)"),
        description: z.string().trim().max(1000, "Слишком длинное описание").optional(),
      })
    )
    .output(z.object({ success: z.boolean(), message: z.string() }))
    .mutation(async ({ input, ctx }) => {
      try {
        await ctx.db.apiKey.updateMany({
          where: { id: input.id },
          data: { name: input.name, description: input.description },
        });

        return { success: true, message: "Имя API-ключа обновлено" };
      } catch (error) {
        handlePrismaError(error, {
          uniqueConstraint: { name: "Это имя уже занято другим ключом" },
          notFound: "Ключ не найден или доступ запрещен",
          defaultConflict: "API-ключ с таким именем уже существует",
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

        return { success: true, message: "API-ключ отозван" };
      } catch (error) {
        handlePrismaError(error, { notFound: "Ключ не найден" });
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
