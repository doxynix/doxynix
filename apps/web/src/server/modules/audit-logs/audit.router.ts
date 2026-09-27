import * as z from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/core/trpc/init";

import { auditService } from "./audit.service";
import { ActivityLogsOutputSchema } from "./audit-logs.schemas";

export const auditRouter = createTRPCRouter({
  getActivityLogs: protectedProcedure
    .input(
      z.object({
        cursor: z.string().nullish(),
        limit: z.number().min(1).max(100).default(20),
      }),
    )
    .output(ActivityLogsOutputSchema)
    .query(async ({ ctx, input }) => {
      return auditService.getActivityLogs(ctx.db, Number(ctx.session.user.id), input);
    }),

  getLogPayloadHtml: protectedProcedure
    .input(z.object({ logId: z.string() }))
    .output(z.string())
    .query(async ({ ctx, input }) => {
      return auditService.getLogPayloadHtml(ctx.db, Number(ctx.session.user.id), input.logId);
    }),
});
