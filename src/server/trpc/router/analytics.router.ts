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
      const userId = Number(ctx.session.user.id);

      const userRepos = await ctx.prisma.repo.findMany({
        where: { userId },
        select: { id: true },
      });

      const repoIds = userRepos.map((r) => r.id);

      if (repoIds.length === 0) {
        return {
          repoCount: 0,
          docsCount: 0,
          analysisCount: 0,
          failedAnalyses: 0,
          pendingAnalyses: 0,
        };
      }

      const [docsCount, totalAnalyses, failedAnalyses, pendingAnalyses] = await Promise.all([
        ctx.prisma.document.count({
          where: { repoId: { in: repoIds } },
        }),
        ctx.prisma.analysis.count({
          where: { repoId: { in: repoIds } },
        }),
        ctx.prisma.analysis.count({
          where: { repoId: { in: repoIds }, status: "FAILED" },
        }),
        ctx.prisma.analysis.count({
          where: { repoId: { in: repoIds }, status: "PENDING" },
        }),
      ]);

      return {
        repoCount: repoIds.length,
        docsCount,
        analysisCount: totalAnalyses,
        failedAnalyses,
        pendingAnalyses,
      };
    }),
});
