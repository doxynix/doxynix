import { unstable_cache } from "next/cache";
import { auth } from "@trigger.dev/sdk";
import { TRPCError } from "@trpc/server";
import z from "zod";

import { DocTypeSchema } from "@/shared/api-contracts";
import { UpdatePRConfigInput } from "@/shared/api/schemas/pr-analysis.schema";

import { appLogger } from "@/server/core/app-logger";
import { getClientContext, getInstallationClient } from "@/server/core/github/github-provider";
import { OpenApiErrorResponses } from "@/server/core/trpc/constants";
import { createTRPCRouter, protectedProcedure } from "@/server/core/trpc/init";
import { markdownToHtml } from "@/server/utils/markdown-to-html";
import { REDIS_CONFIG } from "@/server/utils/redis";
import type { FileActionPreviewResult } from "@/server/utils/types";

import { analysisRepo } from "./analysis.repository";
import {
  FindingForFixSchema,
  FixApplicationPayloadSchema,
  FixResultSchema,
  GeneratedFixDetailedDTO,
  GeneratedFixDTO,
  StagedFixedFileSchema,
} from "./analysis.schemas";
import { repoAnalysisService } from "./analysis.service";
import type { AIResult } from "./engine/core/analysis-result.schemas";
import { FixService } from "./logic/fix-generator";
import { PRConfigService } from "./logic/pr-config";
import type { FindingForFix } from "./logic/pr-types";
import { DocumentFormatter } from "./logic/section-graph-linker";
import { generateFixTask } from "./tasks/generate-fix.task";

const DEFAULT_DOC_LANGUAGE = "English";
const FileActionResultSchema = z.enum(["document-file-preview", "quick-file-audit"]);

export const analysisRouter = createTRPCRouter({
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
    .output(z.object({ jobId: z.string(), publicAccessToken: z.string(), status: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return repoAnalysisService.analyze(ctx.db, Number(ctx.session.user.id), input);
    }),

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

        const fix = await analysisRepo.getById(ctx.db, input.fixId);

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
        await analysisRepo.updateStatus(ctx.db, fix.publicId, "PR_OPENED", {
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
   * Очищает корзину после создания PR.
   */
  clearStaging: protectedProcedure
    .input(z.object({ repoId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const cacheKey = REDIS_CONFIG.keys.prStaging(ctx.session.user.id, input.repoId);
      await ctx.redis.del(cacheKey);
      return { success: true };
    }),

  /**
   * Configure PR analysis for a repo
   */
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
        ctx.db
      );
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

        const fix = await analysisRepo.create(ctx.db, {
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
  documentFile: protectedProcedure
    .input(
      z.object({
        analysisId: z.uuid().optional(),
        commitSha: z.string().optional(),
        content: z.string(),
        language: z.string().default(DEFAULT_DOC_LANGUAGE),
        nodeId: z.string().optional(),
        path: z.string(),
        repoId: z.uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return repoAnalysisService.documentFile(ctx.db, Number(ctx.session.user.id), input);
    }),

  /**
   * Get PR analysis by analysis ID
   */
  getAnalysis: protectedProcedure
    .input(z.object({ analysisId: z.string() }))
    .query(async ({ ctx, input }) => {
      const analysis = await ctx.db.pullRequestAnalysis.findUnique({
        select: {
          baseSha: true,
          createdAt: true,
          error: true,
          headSha: true,
          prNumber: true,
          publicId: true,
          riskScore: true,
          status: true,
        },
        where: { publicId: input.analysisId },
      });

      if (analysis == null) {
        throw new Error("Analysis not found");
      }

      return analysis;
    }),

  getAvailableDocs: protectedProcedure
    .input(z.object({ aid: z.string().optional(), repoId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      return repoAnalysisService.getAvailableDocs(ctx.db, input.repoId, input.aid);
    }),

  /**
   * Get fix metadata (no diffs in response)
   */
  getById: protectedProcedure
    .input(z.object({ fixId: z.uuid() }))
    .output(GeneratedFixDetailedDTO)
    .query(async ({ ctx, input }) => {
      const fix = await analysisRepo.getById(ctx.db, input.fixId);

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
   * Get PR analysis by repo and PR number
   */
  getByPRNumber: protectedProcedure
    .input(
      z.object({
        prNumber: z.number().int().positive(),
        repoId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const analysis = await repoAnalysisService.getByRepoAndPRNumber(
        ctx.db,
        input.repoId,
        input.prNumber
      );

      if (analysis == null) return null;

      return analysis;
    }),

  /**
   * Get all fixes for a repo (metadata only)
   */
  getByRepository: protectedProcedure
    .input(z.object({ repoId: z.uuid() }))
    .output(z.array(GeneratedFixDTO))
    .query(async ({ ctx, input }) => {
      const fixes = await analysisRepo.getByRepoId(ctx.db, input.repoId);
      return fixes.map((fix) => ({ ...fix, id: fix.publicId }));
    }),

  /**
   * Get PR comments for an analysis
   */
  getComments: protectedProcedure
    .input(z.object({ analysisId: z.string() }))
    .query(async ({ ctx, input }) => {
      const comments = await ctx.db.pullRequestComment.findMany({
        orderBy: [{ filePath: "asc" }, { line: "asc" }],
        select: {
          body: true,
          filePath: true,
          findingType: true,
          line: true,
          publicId: true,
          riskLevel: true,
        },
        where: {
          analysis: { publicId: input.analysisId },
        },
      });

      const renderedComments = await Promise.all(
        comments.map(async (c) => {
          const html = await unstable_cache(
            async () => markdownToHtml(c.body),
            [`comment-html-${c.publicId}`],
            {
              revalidate: false,
              tags: ["comments", c.publicId],
            }
          )();
          return {
            bodyHtml: html,
            filePath: c.filePath,
            findingType: c.findingType,
            id: c.publicId,
            line: c.line,
            riskLevel: c.riskLevel,
          };
        })
      );

      return {
        renderedComments,
      };
    }),

  getDetailedMetrics: protectedProcedure
    .input(z.object({ aid: z.string().optional(), repoId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      return repoAnalysisService.getDetailedMetrics(ctx.db, input.repoId, input.aid);
    }),

  getDocumentContent: protectedProcedure
    .input(
      z.object({
        aid: z.string().optional(),
        repoId: z.uuid(),
        type: DocTypeSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      return repoAnalysisService.getDocumentContent(ctx.db, input.repoId, input.type, input.aid);
    }),

  getFileActionResult: protectedProcedure
    .input(
      z.object({
        action: FileActionResultSchema,
        path: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const cacheKey = REDIS_CONFIG.keys.fileAction(ctx.session.user.id, input.path, input.action);
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

  getHistory: protectedProcedure
    .input(z.object({ repoId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      return repoAnalysisService.getHistory(ctx.db, input.repoId);
    }),

  getImpactByPRNumber: protectedProcedure
    .input(
      z.object({
        prNumber: z.number().int().positive(),
        repoId: z.uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      return repoAnalysisService.getByRepoAndPRNumber(ctx.db, input.repoId, input.prNumber);
    }),

  getLatest: protectedProcedure
    .input(z.object({ repoId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const analysis = await ctx.db.analysis.findFirst({
        orderBy: { createdAt: "desc" },
        where: {
          repo: { publicId: input.repoId },
        },
      });

      if (analysis == null) return null;

      let publicAccessToken: null | string = null;

      if (analysis.status === "PENDING" && analysis.jobId != null) {
        try {
          publicAccessToken = await auth.createPublicToken({
            expirationTime: "1h",
            scopes: {
              read: {
                runs: [analysis.jobId],
              },
            },
          });
        } catch (error) {
          console.error("Trigger.dev auth error:", error);
        }
      }

      return {
        ...analysis,
        publicAccessToken,
      };
    }),

  getNodeContext: protectedProcedure
    .input(z.object({ aid: z.string().optional(), nodeId: z.string(), repoId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      return repoAnalysisService.getNodeContext(ctx.db, input.repoId, input.nodeId, input.aid);
    }),

  getRepoConfig: protectedProcedure
    .input(z.object({ repoId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      return PRConfigService.getConfig(input.repoId, ctx.db);
    }),

  /**
   * Получает все текущие изменения для создания PR.
   */
  getStagedFiles: protectedProcedure
    .input(z.object({ repoId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const cacheKey = REDIS_CONFIG.keys.prStaging(ctx.session.user.id, input.repoId);
      const staged = await ctx.redis.hgetall<Record<string, string>>(cacheKey);

      if (staged == null || Object.keys(staged).length === 0) {
        return [];
      }

      return Object.entries(staged).map(([filePath, content]) => ({
        content,
        filePath,
      }));
    }),

  getStructureMap: protectedProcedure
    .input(z.object({ aid: z.string().optional(), repoId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      return repoAnalysisService.getStructureMap(ctx.db, input.repoId, input.aid);
    }),

  getStructureNode: protectedProcedure
    .input(z.object({ aid: z.string().optional(), nodeId: z.string(), repoId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      return repoAnalysisService.getStructureNode(ctx.db, input.repoId, input.nodeId, input.aid);
    }),

  getWithGraphLinks: protectedProcedure
    .input(
      z.object({
        analysisId: z.number(),
        docType: DocTypeSchema,
        repoId: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      const document = await ctx.db.document.findFirst({
        where: {
          analysisId: input.analysisId,
          repoId: input.repoId,
          type: input.docType,
        },
      });

      if (document == null) {
        throw new Error("Document not found");
      }

      const analysis = await ctx.db.analysis.findUnique({
        select: { metricsJson: true, resultJson: true },
        where: { id: input.analysisId },
      });

      const aiResult = analysis?.resultJson as AIResult | null;
      const graph =
        (aiResult as any)?.dependencyGraph ?? (analysis?.metricsJson as any)?.dependencyGraph ?? {};

      const formatted = DocumentFormatter.withGraphLinks(
        document.content,
        graph,
        input.docType,
        document.version
      );

      return {
        ...document,
        sections: formatted.sections,
      };
    }),

  getWorkspace: protectedProcedure
    .input(z.object({ aid: z.string().optional(), repoId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      return repoAnalysisService.getWorkspace(ctx.db, input.repoId, input.aid);
    }),

  highlightFile: protectedProcedure
    .input(z.object({ content: z.string(), path: z.string() }))
    .query(async ({ input }) => {
      return repoAnalysisService.highlightFile(input.content, input.path);
    }),

  listByRepository: protectedProcedure
    .input(z.object({ repoId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const items = await ctx.db.pullRequestAnalysis.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          _count: {
            select: { comments: true },
          },
          createdAt: true,
          headSha: true,
          prNumber: true,
          publicId: true,
          riskScore: true,
          status: true,
        },
        where: {
          repo: {
            publicId: input.repoId,
          },
        },
      });

      return items.map((item) => ({
        createdAt: item.createdAt,
        findingCount: item._count.comments,
        headSha: item.headSha,
        id: item.publicId,
        prNumber: item.prNumber,
        riskScore: item.riskScore,
        status: item.status,
      }));
    }),

  openPullRequest: protectedProcedure
    .input(
      z.object({
        branch: z.string().min(1),
        repoId: z.uuid(),
        title: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      appLogger.info({
        branch: input.branch,
        msg: "staged_pr_open_requested",
        repoId: input.repoId,
        userId: ctx.session.user.id,
      });

      const repo = await ctx.db.repo.findUnique({
        where: { publicId: input.repoId },
      });

      if (repo == null) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Repository not found",
        });
      }

      const installation = await ctx.db.githubInstallation.findFirst({
        where: {
          accountLogin: { equals: repo.owner, mode: "insensitive" },
          isSuspended: false,
        },
      });

      if (installation == null) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `GitHub App is not installed for ${repo.owner}. Please install it first.`,
        });
      }

      const botOctokit = getInstallationClient(Number(installation.id));

      const cacheKey = REDIS_CONFIG.keys.prStaging(ctx.session.user.id, input.repoId);
      const staged = await ctx.redis.hgetall<Record<string, string>>(cacheKey);

      if (staged == null || Object.keys(staged).length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No staged files available for pull request creation",
        });
      }

      const fix = await analysisRepo.create(ctx.db, {
        branch: input.branch,
        createdByUser: true,
        description: "Workspace staged changes opened through PR Draft.",
        repoId: repo.publicId,
        title: input.title,
      });

      try {
        const fixService = new FixService();

        const result = await fixService.applyFix(botOctokit, {
          branch: input.branch,
          defaultBranch: repo.defaultBranch,
          fixedFiles: Object.entries(staged).map(([filePath, newContent]) => ({
            filePath,
            newContent,
          })),
          fixId: fix.publicId,
          owner: repo.owner,
          repoId: repo.publicId,
          repoName: repo.name,
          title: input.title,
        });

        await analysisRepo.updateStatus(ctx.db, fix.publicId, "PR_OPENED", {
          githubPrNumber: result.prNumber,
          githubPrUrl: result.prUrl,
        });

        await ctx.redis.del(cacheKey);

        return {
          fixId: fix.publicId,
          prNumber: result.prNumber,
          prUrl: result.prUrl,
          success: true,
        };
      } catch (error) {
        appLogger.error({
          error: error instanceof Error ? error.message : String(error),
          fixId: fix.publicId,
          msg: "staged_pr_open_failed",
          repoId: input.repoId,
        });

        await analysisRepo.updateStatus(ctx.db, fix.publicId, "FAILED");

        if (error instanceof TRPCError) {
          throw error;
        }

        return {
          error: error instanceof Error ? error.message : "Unknown error",
          success: false,
        };
      }
    }),

  pinAuditToDocs: protectedProcedure
    .input(
      z.object({
        path: z.string(),
        repoId: z.uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const cacheKey = REDIS_CONFIG.keys.fileAction(
        ctx.session.user.id,
        input.path,
        "quick-file-audit"
      );
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
        analysisId: z.uuid().optional(),
        commitSha: z.string().optional(),
        content: z.string(),
        language: z.string().default(DEFAULT_DOC_LANGUAGE),
        nodeId: z.string().optional(),
        path: z.string(),
        repoId: z.uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return repoAnalysisService.runFileAction(
        ctx.db,
        Number(ctx.session.user.id),
        "analyze-single-file",
        input
      );
    }),

  searchWorkspace: protectedProcedure
    .input(z.object({ aid: z.string().optional(), repoId: z.uuid(), search: z.string() }))
    .query(async ({ ctx, input }) => {
      return repoAnalysisService.searchWorkspace(ctx.db, input.repoId, input.search, input.aid);
    }),

  /**
   * Добавляет файл в "корзину" изменений репозитория в Redis.
   * Ключ: pr-stage:{userId}:{repoId}
   */
  stageFile: protectedProcedure
    .input(
      z.object({
        content: z.string(),
        filePath: z.string(),
        repoId: z.uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const cacheKey = REDIS_CONFIG.keys.prStaging(ctx.session.user.id, input.repoId);

      await ctx.redis.hset(cacheKey, { [input.filePath]: input.content });
      await ctx.redis.expire(cacheKey, REDIS_CONFIG.ttl.prStaging);

      const stagedCount = await ctx.redis.hlen(cacheKey);

      return { stagedCount, success: true };
    }),

  stageGeneratedFix: protectedProcedure
    .input(
      z.object({
        fixId: z.string(),
        repoId: z.uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const fix = await analysisRepo.getById(ctx.db, input.fixId);
      if (fix == null) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Generated fix not found",
        });
      }

      // Verify that the fix belongs to the requested repo
      const fixRepo = await ctx.db.repo.findUnique({
        select: { publicId: true },
        where: { id: fix.repoId },
      });

      if (fixRepo == null || fixRepo.publicId !== input.repoId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Generated fix does not belong to the specified repository",
        });
      }

      const cachedResult = await ctx.redis.get(REDIS_CONFIG.keys.fixResult(input.fixId));
      const parsed = z
        .object({
          fixedFiles: z.array(StagedFixedFileSchema).min(1),
        })
        .safeParse(cachedResult);

      if (!parsed.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Generated fix result is not ready for staging",
        });
      }

      const cacheKey = REDIS_CONFIG.keys.prStaging(ctx.session.user.id, input.repoId);
      const stagedEntries = Object.fromEntries(
        parsed.data.fixedFiles.map((file) => [file.filePath, file.newContent] as const)
      );

      await ctx.redis.hset(cacheKey, stagedEntries);
      await ctx.redis.expire(cacheKey, REDIS_CONFIG.ttl.prStaging);

      const stagedCount = await ctx.redis.hlen(cacheKey);

      return {
        stagedCount,
        stagedFilesAdded: parsed.data.fixedFiles.length,
        success: true,
      };
    }),

  unstageFile: protectedProcedure
    .input(
      z.object({
        filePath: z.string(),
        repoId: z.uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const cacheKey = REDIS_CONFIG.keys.prStaging(ctx.session.user.id, input.repoId);

      await ctx.redis.hdel(cacheKey, input.filePath);
      const stagedCount = await ctx.redis.hlen(cacheKey);

      return { stagedCount, success: true };
    }),
});
