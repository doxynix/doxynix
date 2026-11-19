import { CursorMetaSchema, UpdatePRConfigInput } from "@doxynix/shared";
import * as z from "zod";

import { appLogger } from "@/server/core/app-logger";
import { entitlementProcedure, workspaceProcedure } from "@/server/core/trpc/init";
import { cursorPageSchema } from "@/server/utils/pagination";

import {
  FindingForFixSchema,
  FixApplicationPayloadSchema,
  GeneratedFixDetailedDTO,
  GeneratedFixDTO,
  PRFixesOutputSchema,
} from "./analysis.schemas";
import { PRConfigService } from "./logic/pr-config";
import { fixesService } from "./services/fixes.service";
import { prCommentsService } from "./services/pr-comments.service";
import { prImpactService } from "./services/pr-impact.service";
import { stagingService } from "./services/staging.service";

export const analysisPrFixesRouter = {
  applyFix: entitlementProcedure
    .input(FixApplicationPayloadSchema)
    .output(
      z.object({
        error: z.string().optional(),
        prNumber: z.number().optional(),
        prUrl: z.string().optional(),
        success: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return fixesService.applyFix(ctx.db, ctx.redis, ctx.session.user.id, input, ctx.workspace.id);
    }),
  clearStaging: workspaceProcedure
    .input(z.object({ repoId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      return stagingService.clearStaging(ctx.session.user.id, input.repoId);
    }),
  configureRepository: workspaceProcedure
    .input(UpdatePRConfigInput)
    .mutation(async ({ ctx, input }) => {
      appLogger.info({
        msg: "pr_config_updating",
        repoId: input.repoId,
        userId: ctx.session.user.id,
      });

      return PRConfigService.updateConfig(
        input.repoId,
        {
          ciSkip: input.ciSkip,
          commentStyle: input.commentStyle,
          enabled: input.enabled,
          focusAreas: input.focusAreas,
          tokenBudget: input.tokenBudget,
        },
        ctx.workspace.id,
        ctx.db,
      );
    }),
  createFix: entitlementProcedure
    .input(
      z.object({
        fileContents: z.record(z.string(), z.string()).optional().default({}),
        findings: z.array(FindingForFixSchema).min(1),
        prAnalysisId: z.uuid().optional(),
        repoId: z.uuid(),
      }),
    )
    .output(
      z.object({
        error: z.string().optional(),
        fixId: z.uuid().optional(),
        status: z.string().optional(),
        success: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return fixesService.createFix(ctx.db, ctx.session.user.id, input, ctx.workspace.id);
    }),
  fixAllComments: entitlementProcedure
    .input(z.object({ prAnalysisId: z.uuid() }))
    .output(
      z.object({
        error: z.string().optional(),
        fixId: z.uuid().optional(),
        status: z.string().optional(),
        success: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return prCommentsService.fixAllComments(
        ctx.db,
        ctx.session.user.id,
        input.prAnalysisId,
        ctx.workspace.id,
      );
    }),
  getById: workspaceProcedure
    .input(z.object({ fixId: z.uuid() }))
    .output(GeneratedFixDetailedDTO)
    .query(async ({ ctx, input }) => {
      return fixesService.getById(ctx.db, ctx.redis, input.fixId, ctx.workspace.id);
    }),
  getByRepository: workspaceProcedure
    .input(z.object({ repoId: z.uuid() }).extend(cursorPageSchema(50).shape))
    .output(z.object({ items: z.array(GeneratedFixDTO), meta: CursorMetaSchema }))
    .query(async ({ ctx, input }) => {
      return fixesService.getByRepository(ctx.db, input.repoId, ctx.workspace.id, input);
    }),
  getRepoConfig: workspaceProcedure
    .input(z.object({ repoId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      return PRConfigService.getConfig(input.repoId, ctx.workspace.id, ctx.db);
    }),
  getStagedFiles: workspaceProcedure
    .input(z.object({ repoId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      return stagingService.getStagedFiles(ctx.session.user.id, input.repoId);
    }),
  listFixes: workspaceProcedure
    .input(z.object({ prAnalysisId: z.uuid() }).extend(cursorPageSchema(50).shape))
    .output(PRFixesOutputSchema)
    .query(async ({ ctx, input }) => {
      return prImpactService.listFixes(ctx.db, input.prAnalysisId, ctx.workspace.id, input);
    }),
  openPullRequest: workspaceProcedure
    .input(
      z.object({
        branch: z.string().min(1),
        repoId: z.uuid(),
        title: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return fixesService.openPullRequest(
        ctx.db,
        ctx.redis,
        ctx.session.user.id,
        input,
        ctx.workspace.id,
      );
    }),
  stageFile: workspaceProcedure
    .input(
      z.object({
        content: z.string(),
        filePath: z.string(),
        repoId: z.uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return stagingService.stageFile(
        ctx.session.user.id,
        input.repoId,
        input.filePath,
        input.content,
      );
    }),
  stageGeneratedFix: workspaceProcedure
    .input(
      z.object({
        fixId: z.string(),
        repoId: z.uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return stagingService.stageGeneratedFix(
        ctx.db,
        ctx.redis,
        ctx.session.user.id,
        input,
        ctx.workspace.id,
      );
    }),
  unstageFile: workspaceProcedure
    .input(z.object({ filePath: z.string(), repoId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      return stagingService.unstageFile(ctx.session.user.id, input.repoId, input.filePath);
    }),
};
