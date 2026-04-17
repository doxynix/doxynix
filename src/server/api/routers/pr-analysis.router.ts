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
    .input(z.object({ analysisId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const analysis = await prAnalysisService.getById(ctx.db, input.analysisId);

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
      return await prAnalysisService.getByRepoAndPRNumber(ctx.db, input.repoId, input.prNumber);
    }),

  /**
   * Get PR comments for an analysis
   */
  getComments: protectedProcedure
    .input(z.object({ analysisId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      return prAnalysisService.getCommentsByAnalysis(ctx.db, input.analysisId);
    }),

  /**
   * Toggle PR analysis status for repo
   */
  setAnalysisStatus: protectedProcedure
    .input(
      z.object({
        enabled: z.boolean(),
        repoId: z.number().int().positive(),
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
