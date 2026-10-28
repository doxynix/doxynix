import * as z from "zod";

import { workspaceProcedure } from "@/server/core/trpc/init";

import {
  AnalysisScopeInputSchema,
  NodeContextInputSchema,
  NodeContextOutputSchema,
} from "./analysis.schemas";
import { PostCommentToPROutput, prCommentsService } from "./services/pr-comments.service";
import { prImpactService } from "./services/pr-impact.service";
import { workspaceService } from "./services/workspace.service";
import { workspaceSearchService } from "./services/workspace-search.service";

export const analysisRepoRouter = {
  getAnalysis: workspaceProcedure
    .input(z.object({ analysisId: z.string() }))
    .query(async ({ ctx, input }) => {
      return prImpactService.getAnalysis(ctx.db, input.analysisId, ctx.workspace.id);
    }),
  getByPRNumber: workspaceProcedure
    .input(
      z.object({
        prNumber: z.number().int().positive(),
        repoId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return prImpactService.getByRepoAndPRNumber(
        ctx.db,
        input.repoId,
        input.prNumber,
        ctx.workspace.id,
      );
    }),
  getComments: workspaceProcedure
    .input(z.object({ analysisId: z.string() }))
    .query(async ({ ctx, input }) => {
      return prCommentsService.getComments(ctx.db, input.analysisId, ctx.workspace.id);
    }),
  getNodeContext: workspaceProcedure
    .input(NodeContextInputSchema)
    .output(NodeContextOutputSchema)
    .query(async ({ ctx, input }) => {
      return workspaceService.getNodeContext(
        ctx.db,
        input.repoId,
        input.nodeId,
        ctx.workspace.id,
        input.aid,
      );
    }),
  getStructureMap: workspaceProcedure
    .input(AnalysisScopeInputSchema)
    .query(async ({ ctx, input }) => {
      return workspaceService.getStructureMap(ctx.db, input.repoId, ctx.workspace.id, input.aid);
    }),
  getStructureNode: workspaceProcedure
    .input(NodeContextInputSchema)
    .query(async ({ ctx, input }) => {
      return workspaceService.getStructureNode(
        ctx.db,
        input.repoId,
        input.nodeId,
        ctx.workspace.id,
        input.aid,
      );
    }),
  listByRepository: workspaceProcedure
    .input(z.object({ repoId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      return prImpactService.listByRepository(ctx.db, input.repoId, ctx.workspace.id);
    }),
  postCommentToPR: workspaceProcedure
    .input(
      z.object({
        body: z.string().min(1).max(5000),
        prNumber: z.number().int().positive(),
        repoId: z.uuid(),
      }),
    )
    .output(PostCommentToPROutput)
    .mutation(async ({ ctx, input }) => {
      return prCommentsService.postCommentToPR(ctx.db, input, ctx.workspace.id);
    }),
  searchWorkspace: workspaceProcedure
    .input(
      z.object({
        aid: z.string().optional(),
        repoId: z.uuid(),
        search: z.string().trim().min(2).max(200),
      }),
    )
    .query(async ({ ctx, input }) => {
      return workspaceSearchService.search(
        ctx.db,
        input.repoId,
        input.search,
        ctx.workspace.id,
        input.aid,
      );
    }),
};
