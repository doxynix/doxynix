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
        repoId: z.number().int().positive(),
        tokenBudget: z.number().int().min(10_000).max(100_000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      logger.info({
        msg: "pr_config_updating",
        repoId: input.repoId,
        userId: ctx.session.user.id,
      });

      return await PRConfigService.updateConfig(input.repoId, {
        commentStyle: input.commentStyle,
        enabled: input.enabled,
        focusAreas: input.focusAreas,
        tokenBudget: input.tokenBudget,
      });
    }),

  /**
   * Disable PR analysis for repo
   */
  disableAnalysis: protectedProcedure
    .input(z.object({ repoId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      await PRConfigService.disablePRAnalysis(input.repoId);
      return { enabled: false };
    }),

  /**
   * Enable PR analysis for repo
   */
  enableAnalysis: protectedProcedure
    .input(z.object({ repoId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      await PRConfigService.enablePRAnalysis(input.repoId);
      return { enabled: true };
    }),

  /**
   * Get PR analysis by analysis ID
   */
  getAnalysis: protectedProcedure
    .input(z.object({ analysisId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const analysis = await prAnalysisService.getById(ctx.prisma, input.analysisId);

      if (analysis == null) {
        throw new Error("Analysis not found");
      }

      return analysis;
    }),

  /**
   * Get PR analysis by repo and PR number
   */
  getByPRNumber: protectedProcedure
    .input(
      z.object({
        prNumber: z.number().int().positive(),
        repoId: z.number().int().positive(),
      })
    )
    .query(async ({ ctx, input }) => {
      return await prAnalysisService.getByRepoAndPRNumber(ctx.prisma, input.repoId, input.prNumber);
    }),

  /**
   * Get PR comments for an analysis
   */
  getComments: protectedProcedure
    .input(z.object({ analysisId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      return prAnalysisService.getCommentsByAnalysis(ctx.prisma, input.analysisId);
    }),
});
