import z from "zod";

import { OpenApiErrorResponses } from "@/server/trpc/shared";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc/trpc";

export const analyticsRouter = createTRPCRouter({
  getDashboardStats: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/analytics",
        tags: ["analytics"],
        summary: "Retrieve dashboard statistics",
        description:
          "Fetches aggregated analytics data used on the dashboard, including repository metrics, user activity, and other performance indicators. Accessible only to authenticated users.",
        protect: true,
        errorResponses: OpenApiErrorResponses,
      },
    })
    .input(z.void())
    .output(
      z.object({
        repoCount: z.number().int(),
        docsCount: z.number().int(),
        analysisCount: z.number().int(),
        failedAnalyses: z.number().int(),
        pendingAnalyses: z.number().int(),
      })
    )
    .query(async ({ ctx }) => {
      const [repoCount, docsCount, analysisCount, failedAnalyses, pendingAnalyses] =
        await Promise.all([
          ctx.db.repo.count(),
          ctx.db.document.count(),
          ctx.db.analysis.count(),
          ctx.db.analysis.count({ where: { status: "FAILED" } }),
          ctx.db.analysis.count({ where: { status: "PENDING" } }),
        ]);

      return {
        repoCount,
        docsCount,
        analysisCount,
        failedAnalyses,
        pendingAnalyses,
      };
    }),
});
