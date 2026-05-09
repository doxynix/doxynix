import { z } from "zod";

import { repoDetailsService } from "@/server/entities/analyze/api/repo-details.service";
import { DocumentFormatter } from "@/server/features/analyze-repo/lib/section-graph-linker";
import type { AIResult } from "@/server/shared/engine/core/analysis-result.schemas";
import { DocTypeSchema } from "@/generated/zod";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const repoDetailsRouter = createTRPCRouter({
  getAvailableDocs: protectedProcedure
    .input(z.object({ aid: z.string().optional(), repoId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      return repoDetailsService.getAvailableDocs(ctx.db, input.repoId, input.aid);
    }),

  getDetailedMetrics: protectedProcedure
    .input(z.object({ aid: z.string().optional(), repoId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      return repoDetailsService.getDetailedMetrics(ctx.db, input.repoId, input.aid);
    }),

  getDocumentContent: protectedProcedure
    .input(
      z.object({
        aid: z.string().optional(),
        repoId: z.uuid(),
        type: DocTypeSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      return repoDetailsService.getDocumentContent(ctx.db, input.repoId, input.type, input.aid);
    }),

  getHistory: protectedProcedure
    .input(z.object({ repoId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      return repoDetailsService.getHistory(ctx.db, input.repoId);
    }),

  getNodeContext: protectedProcedure
    .input(z.object({ aid: z.string().optional(), nodeId: z.string(), repoId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      return repoDetailsService.getNodeContext(ctx.db, input.repoId, input.nodeId, input.aid);
    }),

  getStructureMap: protectedProcedure
    .input(z.object({ aid: z.string().optional(), repoId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      return repoDetailsService.getStructureMap(ctx.db, input.repoId, input.aid);
    }),

  getStructureNode: protectedProcedure
    .input(z.object({ aid: z.string().optional(), nodeId: z.string(), repoId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      return repoDetailsService.getStructureNode(ctx.db, input.repoId, input.nodeId, input.aid);
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
    .input(z.object({ aid: z.string().optional(), repoId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      return repoDetailsService.getWorkspace(ctx.db, input.repoId, input.aid);
    }),

  highlightFile: protectedProcedure
    .input(z.object({ content: z.string(), path: z.string() }))
    .query(async ({ input }) => {
      return repoDetailsService.highlightFile(input.content, input.path);
    }),

  searchWorkspace: protectedProcedure
    .input(z.object({ aid: z.string().optional(), repoId: z.uuid(), search: z.string() }))
    .query(async ({ ctx, input }) => {
      return repoDetailsService.searchWorkspace(ctx.db, input.repoId, input.search, input.aid);
    }),
});
