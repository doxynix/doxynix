import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { prAnalysisService } from "@/server/entities/pr-analysis/api/pr-analysis.service";
import { PRConfigService } from "@/server/features/pr-analysis/lib/pr-config";
import { logger } from "@/server/shared/infrastructure/logger";

export const prAnalysisRouter = createTRPCRouter({
  /**
   * Configure PR analysis for a repo
   */
  configureRepository: protectedProcedure
    .input(
      z.object({
        commentStyle: z.enum(["concise", "detailed", "off"]).optional(),
        enabled: z.boolean().optional(),
        focusAreas: z
          .array(z.enum(["architecture", "performance", "security", "style"]))
          .optional(),
        repoId: z.string(),
        tokenBudget: z.number().int().min(10_000).max(100_000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      logger.info({
        msg: "pr_config_updating",
        repoId: input.repoId,
        userId: ctx.session.user.id,
      });

      return await PRConfigService.updateConfig(
        input.repoId,
        {
          commentStyle: input.commentStyle,
          enabled: input.enabled,
          focusAreas: input.focusAreas,
          tokenBudget: input.tokenBudget,
        },
        ctx.db
      );
    }),

  /**
   * Get PR analysis by analysis ID
   */
  getAnalysis: protectedProcedure
    .input(z.object({ analysisId: z.string() }))
    .query(async ({ ctx, input }) => {
      const analysis = await ctx.db.pullRequestAnalysis.findUnique({
        select: {
          baseSha: true,
          createdAt: true,
          error: true,
          headSha: true,
          prNumber: true,
          publicId: true,
          riskScore: true,
          status: true,
        },
        where: { publicId: input.analysisId },
      });

      if (analysis == null) {
        throw new Error("Analysis not found");
      }

      const { publicId, ...rest } = analysis;
      return { ...rest, id: publicId };
    }),

  /**
   * Get PR analysis by repo and PR number
   */
  getByPRNumber: protectedProcedure
    .input(
      z.object({
        prNumber: z.number().int().positive(),
        repoId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const analysis = await prAnalysisService.getByRepoAndPRNumber(
        ctx.db,
        input.repoId,
        input.prNumber
      );

      if (!analysis) return null;

      const { publicId, ...rest } = analysis;
      return { ...rest, id: publicId };
    }),

  /**
   * Get PR comments for an analysis
   */
  getComments: protectedProcedure
    .input(z.object({ analysisId: z.string() }))
    .query(async ({ ctx, input }) => {
      const comments = await ctx.db.pullRequestComment.findMany({
        orderBy: [{ filePath: "asc" }, { line: "asc" }],
        select: {
          body: true,
          filePath: true,
          findingType: true,
          line: true,
          publicId: true,
          riskLevel: true,
        },
        where: {
          analysis: { publicId: input.analysisId },
        },
      });

      return comments.map(({ publicId, ...c }) => ({ ...c, id: publicId }));
    }),

  listByRepository: protectedProcedure
    .input(z.object({ repoId: z.string() }))
    .query(async ({ ctx, input }) => {
      const items = await ctx.db.pullRequestAnalysis.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          _count: {
            select: { comments: true },
          },
          createdAt: true,
          headSha: true,
          prNumber: true,
          publicId: true,
          riskScore: true,
          status: true,
        },
        where: {
          repo: {
            publicId: input.repoId,
          },
        },
      });

      return items.map((item) => ({
        createdAt: item.createdAt,
        findingCount: item._count.comments,
        headSha: item.headSha,
        id: item.publicId,
        prNumber: item.prNumber,
        riskScore: item.riskScore,
        status: item.status,
      }));
    }),

  /**
   * Toggle PR analysis status for repo
   */
  setAnalysisStatus: protectedProcedure
    .input(
      z.object({
        enabled: z.boolean(),
        repoId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      logger.info({
        enabled: input.enabled,
        msg: "pr_analysis_status_toggling",
        repoId: input.repoId,
        userId: ctx.session.user.id,
      });

      await PRConfigService.updateConfig(input.repoId, { enabled: input.enabled }, ctx.db);

      return { enabled: input.enabled };
    }),
});
