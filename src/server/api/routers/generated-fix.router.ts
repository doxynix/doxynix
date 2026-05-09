import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { generatedFixService } from "@/server/entities/pr-analysis/api/generated-fix.service";
import { generateFixTask } from "@/server/features/generate-docs/task/generate-fix.task";
import { FixService } from "@/server/features/pr-analysis/lib/fix-generator";
import type { FindingForFix } from "@/server/features/pr-analysis/model/pr-types";
import { appLogger } from "@/server/shared/infrastructure/app-logger";
import { getClientContext } from "@/server/shared/infrastructure/github/github-provider";
import { REDIS_CONFIG } from "@/server/shared/lib/redis";
import { GeneratedFixSchema } from "@/generated/zod";

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const GeneratedFixDTO = GeneratedFixSchema.extend({ id: z.uuid() });

const FixResultSchema = z.object({
  error: z.string().optional(),
  explanation: z.string().optional(),
  fixedFiles: z
    .array(
      z.object({
        diff: z.string().optional(),
        filePath: z.string(),
        newContent: z.string(),
      })
    )
    .optional(),
});

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
  fixId: z.uuid(),
  repoId: z.uuid(),
  title: z.string().min(1),
});

const GeneratedFixDetailedDTO = GeneratedFixSchema.extend({
  id: z.uuid(),
  resultJson: FixResultSchema.nullable(),
});

export const generatedFixRouter = createTRPCRouter({
  /**
   * Apply fix to repository (create PR with full-content strategy).
   * Frontend sends back the fixed file contents that were generated.
   * No DB lookups of diffs - stateless.
   */
  applyFix: protectedProcedure
    .input(FixApplicationPayloadSchema)
    .output(
      z.object({
        error: z.string().optional(),
        prNumber: z.number().optional(),
        prUrl: z.string().optional(),
        success: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      appLogger.info({
        fixId: input.fixId,
        msg: "fix_applying",
        userId: ctx.session.user.id,
      });

      try {
        // Fetch repo metadata (owner, name, defaultBranch)
        const repo = await ctx.db.repo.findUnique({
          where: { publicId: input.repoId },
        });

        if (repo == null) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Repository not found",
          });
        }

        // Resolve GitHub client context (installation or OAuth)
        const clientContext = await getClientContext(
          ctx.db,
          Number(ctx.session.user.id),
          repo.owner
        );

        const fix = await generatedFixService.getById(ctx.db, input.fixId);

        if (fix == null) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Fix not found" });
        }

        // Apply fix using full-content strategy
        const fixService = new FixService();
        const result = await fixService.applyFix(clientContext.octokit, {
          branch: input.branch,
          defaultBranch: repo.defaultBranch,
          fixedFiles: input.fixedFiles,
          fixId: fix.publicId,
          owner: repo.owner,
          repoId: repo.publicId,
          repoName: repo.name,
          title: input.title,
        });

        // Update fix status with PR metadata (no diffs stored)
        await generatedFixService.updateStatus(ctx.db, fix.publicId, "PR_OPENED", {
          githubPrNumber: result.prNumber,
          githubPrUrl: result.prUrl,
        });

        const cacheKey = REDIS_CONFIG.keys.prStaging(ctx.session.user.id, input.repoId);
        await ctx.redis.del(cacheKey);

        return {
          prNumber: result.prNumber,
          prUrl: result.prUrl,
          success: true,
        };
      } catch (error) {
        appLogger.error({
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
        prAnalysisId: z.uuid().optional(),
        repoId: z.uuid(),
      })
    )
    .output(
      z.object({
        error: z.string().optional(),
        fixId: z.uuid().optional(),
        status: z.string().optional(),
        success: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      appLogger.info({
        findingsCount: input.findings.length,
        msg: "fix_creation_triggered",
        repoId: input.repoId,
        userId: ctx.session.user.id,
      });

      try {
        let validPrAnalysisId: string | undefined;

        if (input.prAnalysisId != null) {
          const prAnalysisRecord = await ctx.db.pullRequestAnalysis.findUnique({
            select: { publicId: true },
            where: { publicId: input.prAnalysisId },
          });

          if (prAnalysisRecord != null) {
            validPrAnalysisId = prAnalysisRecord.publicId;
          }
        }

        // Fetch repo metadata (to detect language)
        const repo = await ctx.db.repo.findUnique({
          where: { publicId: input.repoId },
        });

        if (repo == null) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Repository not found",
          });
        }

        const fix = await generatedFixService.create(ctx.prisma, {
          branch: `doxynix/fix-${crypto.randomUUID().slice(0, 8)}`,
          createdByUser: true,
          prAnalysisId: validPrAnalysisId,
          repoId: repo.publicId,
          title: "AI Suggested Improvements",
        });

        await generateFixTask.trigger(
          {
            fileContents: input.fileContents,
            findings: input.findings as FindingForFix[],
            fixId: fix.publicId,
            prAnalysisId: validPrAnalysisId,
            repoId: repo.publicId,
            userId: Number(ctx.session.user.id),
          },
          {
            concurrencyKey: `repo-${repo.id}`,
            idempotencyKey: `fix-${fix.id}`,
            ttl: "30m",
          }
        );

        return {
          fixId: fix.publicId,
          status: "PENDING",
          success: true,
        };
      } catch (error) {
        appLogger.error({
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
    .input(z.object({ fixId: z.uuid() }))
    .output(GeneratedFixDetailedDTO)
    .query(async ({ ctx, input }) => {
      const fix = await generatedFixService.getById(ctx.db, input.fixId);

      if (fix == null) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Fix not found",
        });
      }

      const cachedResult = await ctx.redis.get(REDIS_CONFIG.keys.fixResult(input.fixId));
      const parsedResult = FixResultSchema.safeParse(cachedResult);

      return {
        ...fix,
        id: fix.publicId,
        resultJson: parsedResult.success ? parsedResult.data : null,
      };
    }),

  /**
   * Get all fixes for a repo (metadata only)
   */
  getByRepository: protectedProcedure
    .input(z.object({ repoId: z.uuid() }))
    .output(z.array(GeneratedFixDTO))
    .query(async ({ ctx, input }) => {
      const fixes = await generatedFixService.getByRepoId(ctx.db, input.repoId);
      return fixes.map((fix) => ({ ...fix, id: fix.publicId }));
    }),
});
