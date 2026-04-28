import { z } from "zod";

import { repoDetailsService } from "@/server/entities/analyze/api/repo-details.service";
import { DocumentFormatter } from "@/server/features/analyze-repo/lib/section-graph-linker";
import type { AIResult } from "@/server/shared/engine/core/analysis-result.schemas";
import { DocTypeSchema } from "@/generated/zod";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const repoDetailsRouter = createTRPCRouter({
  getAvailableDocs: protectedProcedure
    .input(z.object({ repoId: z.string() }))
    .query(async ({ ctx, input }) => {
      return repoDetailsService.getAvailableDocs(ctx.db, input.repoId);
    }),

  getDetailedMetrics: protectedProcedure
    .input(z.object({ repoId: z.string() }))
    .query(async ({ ctx, input }) => {
      return repoDetailsService.getDetailedMetrics(ctx.db, input.repoId);
    }),

  getDocumentContent: protectedProcedure
    .input(
      z.object({
        repoId: z.string(),
        type: DocTypeSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      return repoDetailsService.getDocumentContent(ctx.db, input.repoId, input.type);
    }),

  getHistory: protectedProcedure
    .input(z.object({ repoId: z.string() }))
    .query(async ({ ctx, input }) => {
      return repoDetailsService.getHistory(ctx.db, input.repoId);
    }),

  getInteractiveBrief: protectedProcedure
    .input(z.object({ repoId: z.string() }))
    .query(async ({ ctx, input }) => {
      return repoDetailsService.getInteractiveBrief(ctx.db, input.repoId);
    }),

  getInteractiveBriefNode: protectedProcedure
    .input(z.object({ nodeId: z.string(), repoId: z.string() }))
    .query(async ({ ctx, input }) => {
      return repoDetailsService.getInteractiveBriefNode(ctx.db, input.repoId, input.nodeId);
    }),

  getNodeContext: protectedProcedure
    .input(z.object({ nodeId: z.string(), repoId: z.string() }))
    .query(async ({ ctx, input }) => {
      return repoDetailsService.getNodeContext(ctx.db, input.repoId, input.nodeId);
    }),

  getNodeExplain: protectedProcedure
    .input(z.object({ nodeId: z.string(), repoId: z.string() }))
    .query(async ({ ctx, input }) => {
      return repoDetailsService.getNodeExplain(ctx.db, input.repoId, input.nodeId);
    }),

  getOverview: protectedProcedure
    .input(z.object({ repoId: z.string() }))
    .query(async ({ ctx, input }) => {
      return repoDetailsService.getOverview(ctx.db, input.repoId);
    }),

  getStructureMap: protectedProcedure
    .input(z.object({ repoId: z.string() }))
    .query(async ({ ctx, input }) => {
      return repoDetailsService.getStructureMap(ctx.db, input.repoId);
    }),

  getStructureNode: protectedProcedure
    .input(z.object({ nodeId: z.string(), repoId: z.string() }))
    .query(async ({ ctx, input }) => {
      return repoDetailsService.getStructureNode(ctx.db, input.repoId, input.nodeId);
    }),

  getWithGraphLinks: protectedProcedure
    .input(
      z.object({
        analysisId: z.number(),
        docType: DocTypeSchema,
        repoId: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      const document = await ctx.db.document.findFirst({
        where: {
          analysisId: input.analysisId,
          repoId: input.repoId,
          type: input.docType,
        },
      });

      if (document == null) {
        throw new Error("Document not found");
      }

      const analysis = await ctx.db.analysis.findUnique({
        select: { metricsJson: true, resultJson: true },
        where: { id: input.analysisId },
      });

      // Get dependency graph for linking
      const aiResult = analysis?.resultJson as AIResult | null;
      const graph =
        (aiResult as any)?.dependencyGraph ?? (analysis?.metricsJson as any)?.dependencyGraph ?? {};

      // Format with graph links
      const formatted = DocumentFormatter.withGraphLinks(
        document.content,
        graph,
        input.docType,
        document.version
      );

      return {
        ...document,
        sections: formatted.sections,
      };
    }),

  getWorkspace: protectedProcedure
    .input(z.object({ repoId: z.string() }))
    .query(async ({ ctx, input }) => {
      return repoDetailsService.getWorkspace(ctx.db, input.repoId);
    }),

  highlightFile: protectedProcedure
    .input(z.object({ content: z.string(), path: z.string() }))
    .query(async ({ input }) => {
      return repoDetailsService.highlightFile(input.content, input.path);
    }),

  searchWorkspace: protectedProcedure
    .input(z.object({ repoId: z.string(), search: z.string() }))
    .query(async ({ ctx, input }) => {
      return repoDetailsService.searchWorkspace(ctx.db, input.repoId, input.search);
    }),
});
