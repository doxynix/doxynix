import { unstable_cache } from "next/cache";
import { z } from "zod";

import { UpdatePRConfigInput } from "@/shared/api/schemas/pr-analysis.schema";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { prAnalysisService } from "@/server/entities/pr-analysis/api/pr-analysis.service";
import { prImpactService } from "@/server/entities/pr-analysis/api/pr-impact.service";
import { PRConfigService } from "@/server/features/pr-analysis/lib/pr-config";
import { logger } from "@/server/shared/infrastructure/logger";
import { markdownToHtml } from "@/server/shared/lib/markdown-to-html";

export const prAnalysisRouter = createTRPCRouter({
  /**
   * Configure PR analysis for a repo
   */
  configureRepository: protectedProcedure
    .input(UpdatePRConfigInput)
    .mutation(async ({ ctx, input }) => {
      logger.info({
        msg: "pr_config_updating",
        repoId: input.repoId,
        userId: ctx.session.user.id,
      });

      return await PRConfigService.updateConfig(
        input.repoId,
        {
          ciSkip: input.ciSkip,
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

      if (analysis == null) return null;

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

      const renderedComments = await Promise.all(
        comments.map(async (c) => {
          const html = await unstable_cache(
            async () => markdownToHtml(c.body),
            [`comment-html-${c.publicId}`],
            {
              revalidate: false,
              tags: ["comments", c.publicId],
            }
          )();
          return {
            bodyHtml: html,
            filePath: c.filePath,
            findingType: c.findingType,
            id: c.publicId,
            line: c.line,
            riskLevel: c.riskLevel,
          };
        })
      );

      return {
        renderedComments,
      };
    }),

  getImpactByPRNumber: protectedProcedure
    .input(
      z.object({
        prNumber: z.number().int().positive(),
        repoId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      return prImpactService.getByRepoAndPRNumber(ctx.db, input.repoId, input.prNumber);
    }),

  getRepoConfig: protectedProcedure
    .input(z.object({ repoId: z.string() }))
    .query(async ({ ctx, input }) => {
      return await PRConfigService.getConfig(input.repoId, ctx.db);
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
});
