import crypto from "crypto";
import { TRPCError } from "@trpc/server";
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
        summary: "Create a new API Key",
        description:
          "Generates a new API key for the authenticated user. WARNING: The full key is returned only once in this response. We only store the hash.",
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
        await ctx.prisma.apiKey.create({
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
        summary: "List all API Keys",
        description:
          "Retrieves a list of all API keys created by the user, including revoked ones.",
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
      const userId = Number(ctx.session.user.id);

      const allKeys = await ctx.prisma.apiKey.findMany({
        where: {
          userId,
          OR: [{ revoked: true }, { revoked: false }],
        },
        select: {
          id: true,
          name: true,
          description: true,
          prefix: true,
          revoked: true,
          lastUsed: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });

      return {
        active: allKeys.filter((k) => !k.revoked),
        archived: allKeys.filter((k) => k.revoked),
      };
    }),

  update: protectedProcedure
    .meta({
      openapi: {
        method: "PATCH",
        path: "/api-keys/{id}",
        tags: ["api-keys"],
        summary: "Rename an API Key",
        description:
          "Updates the display name of an existing API key. This operation does not change the key value itself or its permissions.",
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
      const userId = Number(ctx.session.user.id);
      try {
        const result = await ctx.prisma.apiKey.updateMany({
          where: { id: input.id, userId },
          data: { name: input.name, description: input.description },
        });

        if (result.count === 0) {
          throw new TRPCError({ code: "NOT_FOUND", message: "API-ключ не найден или был отозван" });
        }

        return { success: true, message: "Имя API-ключа обновлено" };
      } catch (error) {
        handlePrismaError(error, {
          uniqueConstraint: { name: "Это имя уже занято другим ключом" },
          notFound: "Ключ не найден",
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
        summary: "Revoke an API Key",
        description:
          "Revokes the API key immediately. Applications using this key will no longer be able to access the API.",
        protect: true,
        errorResponses: OpenApiErrorResponses,
      },
    })
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ success: z.boolean(), message: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const userId = Number(ctx.session.user.id);
      try {
        const result = await ctx.prisma.apiKey.updateMany({
          where: { id: input.id, userId },
          data: { revoked: true },
        });

        if (result.count === 0) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Ключ не найден или уже отозван" });
        }

        return { success: true, message: "API-ключ отозван" };
      } catch (error) {
        handlePrismaError(error);
      }
    }),

  touch: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/api-keys/{id}/touch",
        tags: ["api-keys"],
        summary: "Update last used timestamp",
        description: "Manually updates the 'last used' date for a key.",
        protect: true,
        errorResponses: OpenApiErrorResponses,
      },
    })
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await ctx.prisma.apiKey.updateMany({
          where: { id: input.id, userId: Number(ctx.session.user.id) },
          data: { lastUsed: new Date() },
        });
        if (result.count === 0)
          throw new TRPCError({ code: "NOT_FOUND", message: "Ключ не найден" });
        return { success: true };
      } catch (error) {
        handlePrismaError(error);
      }
    }),
});
