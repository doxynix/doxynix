import * as z from "zod";

import { protectedProcedure } from "@/server/core/trpc/init";

import { prCommentsService } from "./services/pr-comments.service";
import { prImpactService } from "./services/pr-impact.service";
import { workspaceService } from "./services/workspace.service";
import { workspaceSearchService } from "./services/workspace-search.service";

export const analysisRepoRouter = {
  getAnalysis: protectedProcedure
    .input(z.object({ analysisId: z.string() }))
    .query(async ({ ctx, input }) => {
      return prImpactService.getAnalysis(ctx.db, input.analysisId);
    }),
  getByPRNumber: protectedProcedure
    .input(
      z.object({
        prNumber: z.number().int().positive(),
        repoId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return prImpactService.getByRepoAndPRNumber(ctx.db, input.repoId, input.prNumber);
    }),
  getComments: protectedProcedure
    .input(z.object({ analysisId: z.string() }))
    .query(async ({ ctx, input }) => {
      return prCommentsService.getComments(ctx.db, input.analysisId);
    }),
  getImpactByPRNumber: protectedProcedure
    .input(
      z.object({
        prNumber: z.number().int().positive(),
        repoId: z.uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return prImpactService.getByRepoAndPRNumber(ctx.db, input.repoId, input.prNumber);
    }),
  getNodeContext: protectedProcedure
    .input(z.object({ aid: z.string().optional(), nodeId: z.string(), repoId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      return workspaceService.getNodeContext(ctx.db, input.repoId, input.nodeId, input.aid);
    }),
  getStructureMap: protectedProcedure
    .input(z.object({ aid: z.string().optional(), repoId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      return workspaceService.getStructureMap(ctx.db, input.repoId, input.aid);
    }),
  getStructureNode: protectedProcedure
    .input(z.object({ aid: z.string().optional(), nodeId: z.string(), repoId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      return workspaceService.getStructureNode(ctx.db, input.repoId, input.nodeId, input.aid);
    }),
  listByRepository: protectedProcedure
    .input(z.object({ repoId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      return prImpactService.listByRepository(ctx.db, input.repoId);
    }),
  postCommentToPR: protectedProcedure
    .input(
      z.object({
        body: z.string().min(1).max(5000),
        prNumber: z.number().int().positive(),
        repoId: z.uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return prCommentsService.postCommentToPR(ctx.db, input);
    }),
  searchWorkspace: protectedProcedure
    .input(z.object({ aid: z.string().optional(), repoId: z.uuid(), search: z.string() }))
    .query(async ({ ctx, input }) => {
      return workspaceSearchService.search(ctx.db, input.repoId, input.search, input.aid);
    }),
};
