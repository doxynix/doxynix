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
      const userId = Number(ctx.session.user.id);

      const [repoCount, docsCount, totalAnalyses, failedAnalyses, pendingAnalyses] =
        await Promise.all([
          ctx.prisma.repo.count({
            where: { userId },
          }),
          ctx.prisma.document.count({
            where: { repo: { userId } },
          }),
          ctx.prisma.analysis.count({
            where: { repo: { userId } },
          }),
          ctx.prisma.analysis.count({
            where: {
              repo: { userId },
              status: "FAILED",
            },
          }),
          ctx.prisma.analysis.count({
            where: {
              repo: { userId },
              status: "PENDING",
            },
          }),
        ]);

      return {
        repoCount,
        docsCount,
        analysisCount: totalAnalyses,
        failedAnalyses,
        pendingAnalyses,
      };
    }),
});
