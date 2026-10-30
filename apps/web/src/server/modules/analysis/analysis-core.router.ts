import { DocTypeSchema } from "@doxynix/shared";
import { TRPCError } from "@trpc/server";
import * as z from "zod";

import { analysisStartLimiter } from "@/server/core/ratelimit";
import { entitlementProcedure, workspaceProcedure } from "@/server/core/trpc/init";

import { AnalysisScopeInputSchema } from "./analysis.schemas";
import { AnalysisLatestOutputSchema } from "./analysis-latest.schemas";
import { analysisLifecycleService } from "./services/analysis-lifecycle.service";
import { workspaceService } from "./services/workspace.service";

export const analysisCoreRouter = {
  analyze: entitlementProcedure
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
      const { success } = await analysisStartLimiter.limit(`user:${ctx.session.user.id}`);

      if (!success) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "RATE_LIMITED" });
      }

      return analysisLifecycleService.analyze(ctx.db, ctx.session.user.id, ctx.workspace.id, input);
    }),
  cancel: workspaceProcedure
    .input(z.object({ analysisId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      return analysisLifecycleService.cancel(ctx.db, input.analysisId, ctx.workspace.id);
    }),
  getDetailedMetrics: workspaceProcedure
    .input(AnalysisScopeInputSchema)
    .query(async ({ ctx, input }) => {
      return workspaceService.getDetailedMetrics(ctx.db, input.repoId, ctx.workspace.id, input.aid);
    }),
  getHistory: workspaceProcedure
    .input(z.object({ repoId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      return analysisLifecycleService.getHistory(ctx.db, input.repoId, ctx.workspace.id);
    }),
  getLatest: workspaceProcedure
    .input(z.object({ repoId: z.uuid() }))
    .output(AnalysisLatestOutputSchema)
    .query(async ({ ctx, input }) => {
      return analysisLifecycleService.getLatest(ctx.db, input.repoId, ctx.workspace.id);
    }),
  getWorkspace: workspaceProcedure.input(AnalysisScopeInputSchema).query(async ({ ctx, input }) => {
    return workspaceService.getWorkspace(ctx.db, input.repoId, ctx.workspace.id, input.aid);
  }),
};
