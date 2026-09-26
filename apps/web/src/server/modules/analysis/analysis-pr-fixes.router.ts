import { UpdatePRConfigInput } from "@doxynix/shared";
import * as z from "zod";

import { appLogger } from "@/server/core/app-logger";
import { protectedProcedure } from "@/server/core/trpc/init";

import {
  FindingForFixSchema,
  FixApplicationPayloadSchema,
  GeneratedFixDetailedDTO,
  GeneratedFixDTO,
} from "./analysis.schemas";
import { PRConfigService } from "./logic/pr-config";
import { fixesService } from "./services/fixes.service";
import { stagingService } from "./services/staging.service";

export const analysisPrFixesRouter = {
  applyFix: protectedProcedure
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
      return fixesService.applyFix(ctx.db, ctx.redis, ctx.session.user.id, input);
    }),
  clearStaging: protectedProcedure
    .input(z.object({ repoId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      return stagingService.clearStaging(ctx.session.user.id, input.repoId);
    }),
  configureRepository: protectedProcedure
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
        ctx.db,
      );
    }),
  createFix: protectedProcedure
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
      return fixesService.createFix(ctx.db, Number(ctx.session.user.id), input);
    }),
  getById: protectedProcedure
    .input(z.object({ fixId: z.uuid() }))
    .output(GeneratedFixDetailedDTO)
    .query(async ({ ctx, input }) => {
      return fixesService.getById(ctx.db, ctx.redis, input.fixId);
    }),
  getByRepository: protectedProcedure
    .input(z.object({ repoId: z.uuid() }))
    .output(z.array(GeneratedFixDTO))
    .query(async ({ ctx, input }) => {
      return fixesService.getByRepository(ctx.db, input.repoId);
    }),
  getRepoConfig: protectedProcedure
    .input(z.object({ repoId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      return PRConfigService.getConfig(input.repoId, ctx.db);
    }),
  getStagedFiles: protectedProcedure
    .input(z.object({ repoId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      return stagingService.getStagedFiles(ctx.session.user.id, input.repoId);
    }),
  openPullRequest: protectedProcedure
    .input(
      z.object({
        branch: z.string().min(1),
        repoId: z.uuid(),
        title: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return fixesService.openPullRequest(ctx.db, ctx.redis, ctx.session.user.id, input);
    }),
  stageFile: protectedProcedure
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
  stageGeneratedFix: protectedProcedure
    .input(
      z.object({
        fixId: z.string(),
        repoId: z.uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return stagingService.stageGeneratedFix(ctx.db, ctx.redis, ctx.session.user.id, input);
    }),
  unstageFile: protectedProcedure
    .input(z.object({ filePath: z.string(), repoId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      return stagingService.unstageFile(ctx.session.user.id, input.repoId, input.filePath);
    }),
};
