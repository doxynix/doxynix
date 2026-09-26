import { TRPCError } from "@trpc/server";
import type { Redis } from "@upstash/redis";
import * as z from "zod";

import { generateBranchName } from "@/shared/lib/get-branch-name";

import { appLogger } from "@/server/core/app-logger";
import type { DbClient } from "@/server/core/db";
import { getClientContext, getInstallationClient } from "@/server/core/github/github-provider";
import { redisService } from "@/server/core/redis";
import { REDIS_CONFIG } from "@/server/utils/redis";

import { analysisRepo } from "../analysis.repository";
import {
  type FindingForFixSchema,
  type FixApplicationPayloadSchema,
  FixResultSchema,
  StagedFixedFileSchema,
} from "../analysis.schemas";
import { FixService } from "../logic/fix-generator";
import { generateFixTask } from "../tasks/generate-fix.task";

const StagedFixResultSchema = z.object({
  fixedFiles: z.array(StagedFixedFileSchema).min(1),
});

export const fixesService = {
  async applyFix(
    db: DbClient,
    redis: Redis,
    userId: string,
    input: z.infer<typeof FixApplicationPayloadSchema>,
  ) {
    appLogger.info({
      fixId: input.fixId,
      msg: "fix_applying",
      userId,
    });

    try {
      // Fetch repo metadata (owner, name, defaultBranch)
      const repo = await db.repo.findUnique({
        where: { publicId: input.repoId },
      });

      if (repo == null) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Repository not found",
        });
      }

      // Resolve GitHub client context (installation or OAuth)
      const clientContext = await getClientContext(db, Number(userId), repo.owner);

      const fix = await analysisRepo.getById(db, input.fixId);

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
      await analysisRepo.updateStatus(db, fix.publicId, "PR_OPENED", {
        githubPrNumber: result.prNumber,
        githubPrUrl: result.prUrl,
      });

      await redis.del(REDIS_CONFIG.keys.prStaging(userId, input.repoId));

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
  },

  /**
   * Clears the staging area after creating a PR.
   */
  async clearStaging(userId: string, repoId: string) {
    await redisService.staging.clear(userId, repoId);
    return { success: true };
  },
  async createFix(
    db: DbClient,
    userId: number,
    input: {
      fileContents: Record<string, string>;
      findings: z.infer<typeof FindingForFixSchema>[];
      prAnalysisId?: string;
      repoId: string;
    },
  ) {
    appLogger.info({
      findingsCount: input.findings.length,
      msg: "fix_creation_triggered",
      repoId: input.repoId,
      userId,
    });

    try {
      let validPrAnalysisId: string | undefined;

      if (input.prAnalysisId != null) {
        const prAnalysisRecord = await db.pullRequestAnalysis.findUnique({
          select: { publicId: true },
          where: { publicId: input.prAnalysisId },
        });

        if (prAnalysisRecord != null) {
          validPrAnalysisId = prAnalysisRecord.publicId;
        }
      }

      // Fetch repo metadata (to detect language)
      const repo = await db.repo.findUnique({
        where: { publicId: input.repoId },
      });

      if (repo == null) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Repository not found",
        });
      }

      const fix = await analysisRepo.create(db, {
        branch: generateBranchName(),
        createdByUser: true,
        prAnalysisId: validPrAnalysisId,
        repoId: repo.publicId,
        title: "AI Suggested Improvements",
      });

      await generateFixTask.trigger(
        {
          fileContents: input.fileContents,
          findings: input.findings,
          fixId: fix.publicId,
          prAnalysisId: validPrAnalysisId,
          repoId: repo.publicId,
          userId,
        },
        {
          // concurrencyKey: `repo-${repo.id}`,
          // idempotencyKey: `fix-${fix.id}`,
          ttl: "30m",
        },
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
  },

  /**
   * Get fix metadata (no diffs in response)
   */
  async getById(db: DbClient, redis: Redis, fixId: string) {
    const fix = await analysisRepo.getById(db, fixId);

    if (fix == null) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Fix not found",
      });
    }

    const cachedResult = await redis.get(REDIS_CONFIG.keys.fixResult(fixId));
    const parsedResult = FixResultSchema.safeParse(cachedResult);

    return {
      ...fix,
      id: fix.publicId,
      resultJson: parsedResult.success ? parsedResult.data : null,
    };
  },

  /**
   * Get all fixes for a repo (metadata only)
   */
  async getByRepository(db: DbClient, repoId: string) {
    const fixes = await analysisRepo.getByRepoId(db, repoId);
    return fixes.map((fix) => ({ ...fix, id: fix.publicId }));
  },

  /**
   * Gets all currently staged changes for creating a PR.
   */
  async getStagedFiles(userId: string, repoId: string) {
    return redisService.staging.getAll(userId, repoId);
  },

  async openPullRequest(
    db: DbClient,
    redis: Redis,
    userId: string,
    input: { branch: string; repoId: string; title: string },
  ) {
    appLogger.info({
      branch: input.branch,
      msg: "staged_pr_open_requested",
      repoId: input.repoId,
      userId,
    });

    const repo = await db.repo.findUnique({
      where: { publicId: input.repoId },
    });

    if (repo == null) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Repository not found",
      });
    }

    const installation = await db.githubInstallation.findFirst({
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

    const cacheKey = REDIS_CONFIG.keys.prStaging(userId, input.repoId);
    const staged = await redis.hgetall<Record<string, string>>(cacheKey);

    if (staged == null || Object.keys(staged).length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No staged files available for pull request creation",
      });
    }

    const fix = await analysisRepo.create(db, {
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

      await analysisRepo.updateStatus(db, fix.publicId, "PR_OPENED", {
        githubPrNumber: result.prNumber,
        githubPrUrl: result.prUrl,
      });

      await redis.del(cacheKey);

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

      await analysisRepo.updateStatus(db, fix.publicId, "FAILED");

      if (error instanceof TRPCError) {
        throw error;
      }

      return {
        error: error instanceof Error ? error.message : "Unknown error",
        success: false,
      };
    }
  },

  /**
   * Adds a file to the repository's staged changes in Redis.
   * Key: pr-stage:{userId}:{repoId}
   */
  async stageFile(userId: string, repoId: string, filePath: string, content: string) {
    const stagedCount = await redisService.staging.addFiles(userId, repoId, {
      [filePath]: content,
    });
    return { stagedCount, success: true };
  },

  async stageGeneratedFix(
    db: DbClient,
    redis: Redis,
    userId: string,
    input: { fixId: string; repoId: string },
  ) {
    const fix = await db.generatedFix.findUnique({
      include: {
        repo: {
          select: { publicId: true },
        },
      },
      where: { publicId: input.fixId },
    });

    if (fix == null) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Generated fix not found",
      });
    }

    if (fix.repo.publicId !== input.repoId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Generated fix does not belong to the specified repository",
      });
    }

    const cachedResult = await redis.get(REDIS_CONFIG.keys.fixResult(input.fixId));
    const parsed = StagedFixResultSchema.safeParse(cachedResult);

    if (!parsed.success) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Generated fix result is not ready for staging",
      });
    }

    const cacheKey = REDIS_CONFIG.keys.prStaging(userId, input.repoId);
    const stagedEntries = Object.fromEntries(
      parsed.data.fixedFiles.map((file) => [file.filePath, file.newContent] as const),
    );

    await redis.hset(cacheKey, stagedEntries);
    await redis.expire(cacheKey, REDIS_CONFIG.ttl.prStaging);

    const stagedCount = await redis.hlen(cacheKey);

    return {
      stagedCount,
      stagedFilesAdded: parsed.data.fixedFiles.length,
      success: true,
    };
  },

  async unstageFile(userId: string, repoId: string, filePath: string) {
    const stagedCount = await redisService.staging.removeFile(userId, repoId, filePath);
    return { stagedCount, success: true };
  },
};
