import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { generatedFixService } from "@/server/entities/pr-analysis/api/generated-fix.service";
import { FixService } from "@/server/features/pr-analysis/lib/fix-generator";
import type { FindingForFix } from "@/server/features/pr-analysis/model/pr-types";
import { getClientContext } from "@/server/shared/infrastructure/github/github-provider";
import { logger } from "@/server/shared/infrastructure/logger";

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const FindingForFixSchema = z.object({
  file: z.string().min(1),
  line: z.number().int().positive(),
  suggestion: z.string().optional(),
  type: z.enum(["architecture", "bug", "complexity", "performance", "security", "style"]),
});

const FixedFileContentSchema = z.object({
  filePath: z.string().min(1),
  newContent: z.string().min(1),
});

const FixApplicationPayloadSchema = z.object({
  branch: z.string().min(1),
  estimatedImpact: z.number().int().min(0).max(100),
  fixedFiles: z.array(FixedFileContentSchema).min(1),
  fixId: z.number().int().positive(),
  repoId: z.number().int().positive(),
  title: z.string().min(1),
});

export const generatedFixRouter = createTRPCRouter({
  /**
   * Apply fix to repository (create PR with full-content strategy).
   * Frontend sends back the fixed file contents that were generated.
   * No DB lookups of diffs - stateless.
   */
  applyFix: protectedProcedure
    .input(FixApplicationPayloadSchema)
    .mutation(async ({ ctx, input }) => {
      logger.info({
        fixId: input.fixId,
        msg: "fix_applying",
        userId: ctx.session.user.id,
      });

      try {
        // Fetch repo metadata (owner, name, defaultBranch)
        const repo = await ctx.prisma.repo.findUnique({
          where: { id: input.repoId },
        });

        if (!repo) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Repository not found",
          });
        }

        // Resolve GitHub client context (installation or OAuth)
        const clientContext = await getClientContext(
          ctx.prisma,
          Number(ctx.session.user.id),
          repo.owner
        );

        // Apply fix using full-content strategy
        const fixService = new FixService();
        const result = await fixService.applyFix(clientContext.octokit, {
          branch: input.branch,
          defaultBranch: repo.defaultBranch,
          fixedFiles: input.fixedFiles,
          fixId: input.fixId,
          owner: repo.owner,
          repoId: input.repoId,
          repoName: repo.name,
          title: input.title,
        });

        // Update fix status with PR metadata (no diffs stored)
        await generatedFixService.updateStatus(ctx.prisma, input.fixId, "PR_OPENED", {
          githubPrNumber: result.prNumber,
          githubPrUrl: result.prUrl,
        });

        return {
          prNumber: result.prNumber,
          prUrl: result.prUrl,
          success: true,
        };
      } catch (error) {
        logger.error({
          error: error instanceof Error ? error.message : String(error),
          fixId: input.fixId,
          msg: "fix_apply_failed",
        });

        if (error instanceof TRPCError) {
          throw error;
        }

        return {
          error: error instanceof Error ? error.message : "Unknown error",
          success: false,
        };
      }
    }),

  /**
   * "Fix it for me" - Generate fix from findings (stateless full-content strategy).
   * Returns fixId + diffs for preview. Frontend sends fixed files back to applyFix.
   */
  createFix: protectedProcedure
    .input(
      z.object({
        fileContents: z.record(z.string(), z.string()), // Map of filePath -> originalContent
        findings: z.array(FindingForFixSchema).min(1),
        prAnalysisId: z.number().int().optional(),
        repoId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      logger.info({
        findingsCount: input.findings.length,
        msg: "fix_creation_triggered",
        repoId: input.repoId,
        userId: ctx.session.user.id,
      });

      try {
        // Fetch repo metadata (to detect language)
        const repo = await ctx.prisma.repo.findUnique({
          where: { id: input.repoId },
        });

        if (!repo) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Repository not found",
          });
        }

        // Generate fix in-memory with file contents for diff generation
        const fixService = new FixService();
        const fixResult = await fixService.createFixFromAnalysis({
          fileContents: input.fileContents,
          findings: input.findings as FindingForFix[],
          prAnalysisId: input.prAnalysisId,
          repoContext: { language: repo.language ?? "typescript" },
          repoId: input.repoId,
        });

        // Create fix record (metadata only, no code/diffs stored)
        const fix = await generatedFixService.create(ctx.prisma, {
          branch: fixResult.branch,
          createdByUser: true,
          prAnalysisId: input.prAnalysisId,
          repoId: input.repoId,
          title: fixResult.title,
        });

        logger.info({
          fixId: fix.id,
          msg: "fix_created",
          repoId: input.repoId,
        });

        return {
          branch: fix.branch,
          diffs: fixResult.diffs, // For UI preview only (not stored in DB)
          estimatedImpact: fixResult.estimatedImpact,
          fixedFiles: fixResult.fixedFiles, // Will have placeholders; AI populates in applyFix
          fixId: fix.id,
          title: fix.title,
        };
      } catch (error) {
        logger.error({
          error: error instanceof Error ? error.message : String(error),
          msg: "fix_creation_failed",
          repoId: input.repoId,
        });

        return {
          error: error instanceof Error ? error.message : "Unknown error",
          success: false,
        };
      }
    }),

  /**
   * Get fix metadata (no diffs in response)
   */
  getById: protectedProcedure
    .input(z.object({ fixId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      return generatedFixService.getById(ctx.prisma, input.fixId);
    }),

  /**
   * Get all fixes for a repo (metadata only)
   */
  getByRepository: protectedProcedure
    .input(z.object({ repoId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      return generatedFixService.getByRepoId(ctx.prisma, input.repoId);
    }),
});
