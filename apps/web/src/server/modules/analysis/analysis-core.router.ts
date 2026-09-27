import { DocTypeSchema } from "@doxynix/shared";
import * as z from "zod";

import { protectedProcedure } from "@/server/core/trpc/init";

import { AnalysisScopeInputSchema } from "./analysis.schemas";
import { AnalysisLatestOutputSchema } from "./analysis-latest.schemas";
import { analysisLifecycleService } from "./services/analysis-lifecycle.service";
import { workspaceService } from "./services/workspace.service";

export const analysisCoreRouter = {
  analyze: protectedProcedure
    .input(
      z.object({
        branch: z.string().optional(),
        docTypes: z.array(DocTypeSchema),
        files: z.array(z.string()),
        instructions: z.string().optional(),
        language: z.string(),
        repoId: z.uuid(),
      }),
    )
    .output(z.object({ jobId: z.string(), publicAccessToken: z.string(), status: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return analysisLifecycleService.analyze(ctx.db, Number(ctx.session.user.id), input);
    }),
  cancel: protectedProcedure
    .input(z.object({ analysisId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      return analysisLifecycleService.cancel(ctx.db, input.analysisId);
    }),
  getDetailedMetrics: protectedProcedure
    .input(AnalysisScopeInputSchema)
    .query(async ({ ctx, input }) => {
      return workspaceService.getDetailedMetrics(ctx.db, input.repoId, input.aid);
    }),
  getHistory: protectedProcedure
    .input(z.object({ repoId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      return analysisLifecycleService.getHistory(ctx.db, input.repoId);
    }),
  getLatest: protectedProcedure
    .input(z.object({ repoId: z.uuid() }))
    .output(AnalysisLatestOutputSchema)
    .query(async ({ ctx, input }) => {
      return analysisLifecycleService.getLatest(ctx.db, input.repoId);
    }),
  getWorkspace: protectedProcedure.input(AnalysisScopeInputSchema).query(async ({ ctx, input }) => {
    return workspaceService.getWorkspace(ctx.db, input.repoId, input.aid);
  }),
};
