import { z } from "zod";

import { repoAnalysisService } from "@/server/features/analyze-repo/api/repo-analysis.service";
import { DocTypeSchema } from "@/generated/zod";

import { OpenApiErrorResponses } from "../contracts";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const DEFAULT_DOC_LANGUAGE = "English";

export const repoAnalysisRouter = createTRPCRouter({
  analyze: protectedProcedure
    .meta({
      openapi: {
        errorResponses: OpenApiErrorResponses,
        method: "POST",
        path: "/repos/analyze",
        protect: true,
        summary: "Analyze your repository",
        tags: ["repositories"],
      },
    })
    .input(
      z.object({
        branch: z.string().optional(),
        docTypes: z.array(DocTypeSchema),
        files: z.array(z.string()),
        instructions: z.string().optional(),
        language: z.string(),
        repoId: z.uuid(),
      })
    )
    .output(z.object({ jobId: z.string(), status: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return repoAnalysisService.analyze(ctx.db, Number(ctx.session.user.id), input);
    }),

  analyzeFile: protectedProcedure
    .input(
      z.object({
        content: z.string(),
        language: z.string().default(DEFAULT_DOC_LANGUAGE),
        nodeId: z.string().optional(),
        path: z.string(),
        repoId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return repoAnalysisService.analyzeFile(ctx.db, Number(ctx.session.user.id), input);
    }),

  documentFile: protectedProcedure
    .input(
      z.object({
        content: z.string(),
        language: z.string().default(DEFAULT_DOC_LANGUAGE),
        nodeId: z.string().optional(),
        path: z.string(),
        repoId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return repoAnalysisService.documentFile(ctx.db, Number(ctx.session.user.id), input);
    }),

  documentFilePreview: protectedProcedure
    .input(
      z.object({
        analysisId: z.string().optional(),
        commitSha: z.string().optional(),
        content: z.string(),
        language: z.string().default(DEFAULT_DOC_LANGUAGE),
        nodeId: z.string().optional(),
        path: z.string(),
        repoId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return repoAnalysisService.documentFilePreview(ctx.db, Number(ctx.session.user.id), input);
    }),

  quickFileAudit: protectedProcedure
    .input(
      z.object({
        analysisId: z.string().optional(),
        commitSha: z.string().optional(),
        content: z.string(),
        language: z.string().default(DEFAULT_DOC_LANGUAGE),
        nodeId: z.string().optional(),
        path: z.string(),
        repoId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return repoAnalysisService.quickFileAudit(ctx.db, Number(ctx.session.user.id), input);
    }),
});
