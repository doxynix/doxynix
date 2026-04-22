import { unstable_cache } from "next/cache";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { repoAnalysisService } from "@/server/features/analyze-repo/api/repo-analysis.service";
import { markdownToHtml } from "@/server/shared/lib/markdown-to-html";
import { REDIS_CONFIG } from "@/server/shared/lib/redis";
import type { FileActionPreviewResult } from "@/server/shared/types";
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

  documentFile: protectedProcedure
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
      return repoAnalysisService.documentFile(ctx.db, Number(ctx.session.user.id), input);
    }),

  getFileActionResult: protectedProcedure
    .input(z.object({ path: z.string() }))
    .query(async ({ ctx, input }) => {
      const cacheKey = REDIS_CONFIG.keys.fileAction(ctx.session.user.id, input.path);
      const data = await ctx.redis.get<FileActionPreviewResult>(cacheKey);

      if (data == null) return null;

      const html = await unstable_cache(
        async () => markdownToHtml(data.content),
        [`file-res-html-${cacheKey}`],
        {
          revalidate: false,
          tags: ["file-audit", cacheKey],
        }
      )();

      return {
        ...data,
        html,
      };
    }),

  pinAuditToDocs: protectedProcedure
    .input(
      z.object({
        path: z.string(),
        repoId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const cacheKey = REDIS_CONFIG.keys.fileAction(ctx.session.user.id, input.path);
      const cachedData = await ctx.redis.get<any>(cacheKey);

      if (cachedData == null) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Audit result expired or not found. Please run audit again.",
        });
      }

      const { analysisId, commitSha } = cachedData.contentRef ?? {};

      let internalAnalysisId: number | undefined;
      if (analysisId != null) {
        const analysis = await ctx.db.analysis.findUnique({
          select: { id: true },
          where: { publicId: analysisId },
        });
        internalAnalysisId = analysis?.id;
      }

      const markdownContent = cachedData.content;

      return ctx.db.document.create({
        data: {
          content: markdownContent,
          path: input.path,
          repo: { connect: { publicId: input.repoId } },
          type: "CODE_DOC",
          version: commitSha ?? "manual",
          ...(internalAnalysisId != null
            ? {
                analysis: { connect: { id: internalAnalysisId } },
              }
            : {}),
        },
      });
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
      return repoAnalysisService.auditFile(ctx.db, Number(ctx.session.user.id), input);
    }),
});
