import { tasks } from "@trigger.dev/sdk/v3";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { DocTypeSchema } from "@/generated/zod";

import { OpenApiErrorResponses } from "../shared";
import { createTRPCRouter, protectedProcedure } from "../trpc";

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
      const userId = Number(ctx.session.user.id);

      const repo = await ctx.db.repo.findUnique({
        where: { publicId: input.repoId },
      });

      if (repo == null) throw new TRPCError({ code: "NOT_FOUND", message: "Repository not found" });

      const analysis = await ctx.db.analysis.create({
        data: {
          repo: {
            connect: {
              publicId: input.repoId,
            },
          },
          status: "PENDING",
        },
      });
      const handle = await tasks.trigger(
        "analyze-repo",
        {
          analysisId: analysis.publicId,
          docTypes: input.docTypes,
          instructions: input.instructions,
          language: input.language,
          selectedBranch: input.branch,
          selectedFiles: input.files,
          userId,
        },
        {
          concurrencyKey: `user-${userId}`,
          idempotencyKey: `analysis-${analysis.publicId}`,
          ttl: "30m",
        }
      );

      await ctx.db.analysis.update({
        data: { jobId: handle.id },
        where: { publicId: analysis.publicId },
      });

      return { jobId: handle.id, status: "QUEUED" };
    }),
  analyzeFile: protectedProcedure
    .input(
      z.object({
        content: z.string(),
        language: z.string().default("English"),
        path: z.string(),
        repoId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = Number(ctx.session.user.id);

      const repo = await ctx.db.repo.findFirst({
        where: { publicId: input.repoId, userId: Number(userId) },
      });
      if (!repo) throw new TRPCError({ code: "NOT_FOUND" });

      const handle = await tasks.trigger(
        "analyze-single-file",
        {
          content: input.content,
          language: input.language,
          path: input.path,
          repoId: input.repoId,
        },
        {
          concurrencyKey: `user-${userId}`,
          idempotencyKey: `analyze-file-${input.repoId}-${input.path}`,
          ttl: "10m",
        }
      );

      return { jobId: handle.id };
    }),
  documentFile: protectedProcedure
    .input(
      z.object({
        content: z.string(),
        language: z.string().default("Russian"),
        path: z.string(),
        repoId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = Number(ctx.session.user.id);
      const repo = await ctx.db.repo.findUnique({
        where: { publicId: input.repoId, userId },
      });
      if (!repo) throw new TRPCError({ code: "NOT_FOUND" });

      const handle = await tasks.trigger(
        "document-single-file",
        {
          content: input.content,
          language: input.language,
          path: input.path,
          repoId: input.repoId,
          userId,
        },
        {
          concurrencyKey: `user-${userId}`,
          idempotencyKey: `doc-file-${input.repoId}-${input.path}`,
          ttl: "10m",
        }
      );

      return { jobId: handle.id };
    }),
});
