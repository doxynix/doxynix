import { z } from "zod";

import { repoDetailsService } from "@/server/entities/analyze/api/repo-details.service";
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

  highlightFile: protectedProcedure
    .input(z.object({ content: z.string(), path: z.string() }))
    .query(async ({ input }) => {
      return repoDetailsService.highlightFile(input.content, input.path);
    }),
});
