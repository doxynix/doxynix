import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { highlightCode } from "@/shared/lib/shiki";

import { mapAuditLogToDTO, sanitizeObject } from "@/server/entities/audit/lib/audit-mapper";
import { AUDIT_BUSINESS_MODELS } from "@/server/shared/lib/constants";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const auditRouter = createTRPCRouter({
  getActivityLogs: protectedProcedure
    .input(
      z.object({
        cursor: z.string().nullish(),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const { cursor, limit } = input;
      const userId = Number(ctx.session.user.id);

      const items = await ctx.db.auditLog.findMany({
        cursor: cursor != null ? { id: cursor } : undefined,
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        where: {
          model: {
            in: AUDIT_BUSINESS_MODELS,
          },
          userId,
        },
      });

      let nextCursor: typeof cursor | undefined;
      if (items.length > limit) {
        const nextItem = items.pop();
        nextCursor = nextItem?.id;
      }

      return {
        items: items.map((item) => mapAuditLogToDTO(item)),
        nextCursor,
      };
    }),

  getLogPayloadHtml: protectedProcedure
    .input(z.object({ logId: z.string() }))
    .query(async ({ ctx, input }) => {
      const log = await ctx.db.auditLog.findUnique({
        select: { payload: true },
        where: { id: input.logId, userId: Number(ctx.session.user.id) },
      });

      if (log == null) throw new TRPCError({ code: "NOT_FOUND" });

      const cleanPayload = sanitizeObject(log.payload);

      const jsonString = JSON.stringify(cleanPayload, null, 2);

      return highlightCode(jsonString, "json", "dark", input.logId);
    }),
});
