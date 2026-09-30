import { TRPCError } from "@trpc/server";
import type { Redis } from "@upstash/redis";
import type * as z from "zod";

import { generateBranchName } from "@/shared/lib/get-branch-name";

import { appLogger } from "@/server/core/app-logger";
import type { DbClient } from "@/server/core/db";
import { getClientContext, getInstallationClient } from "@/server/core/github/github-provider";
import { REDIS_CONFIG } from "@/server/utils/redis";

import { analysisRepo } from "../analysis.repository";
import {
  type FindingForFixSchema,
  type FixApplicationPayloadSchema,
  FixResultSchema,
  type GeneratedFixDetailedDTO,
  type GeneratedFixDTO,
} from "../analysis.schemas";
import { fixesMapper } from "../fixes.mapper";
import { FixService } from "../logic/fix-generator";
import { generateFixTask } from "../tasks/generate-fix.task";

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
      const repo = await db.repo.findUnique({
        where: { id: input.repoId },
      });

      if (repo == null) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Repository not found",
        });
      }

      const clientContext = await getClientContext(db, userId, repo.owner);

      const fix = await analysisRepo.getById(db, input.fixId);

      if (fix == null) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Fix not found" });
      }

      const fixService = new FixService();
      const result = await fixService.applyFix(clientContext.octokit, {
        branch: input.branch,
        defaultBranch: repo.defaultBranch,
        fixedFiles: input.fixedFiles,
        fixId: fix.id,
        owner: repo.owner,
        repoId: repo.id,
        repoName: repo.name,
        title: input.title,
      });

      await analysisRepo.updateStatus(db, fix.id, "PR_OPENED", {
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
  async createFix(
    db: DbClient,
    userId: string,
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
          select: { id: true },
          where: { id: input.prAnalysisId },
        });

        if (prAnalysisRecord != null) {
          validPrAnalysisId = prAnalysisRecord.id;
        }
      }

      const repo = await db.repo.findUnique({
        where: { id: input.repoId },
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
        repoId: repo.id,
        title: "AI Suggested Improvements",
      });

      await generateFixTask.trigger(
        {
          fileContents: input.fileContents,
          findings: input.findings,
          fixId: fix.id,
          prAnalysisId: validPrAnalysisId,
          repoId: repo.id,
          userId,
        },
        {
          // concurrencyKey: `repo-${repo.id}`,
          // idempotencyKey: `fix-${fix.id}`,
          ttl: "30m",
        },
      );

      return {
        fixId: fix.id,
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

  async getById(
    db: DbClient,
    redis: Redis,
    fixId: string,
  ): Promise<z.infer<typeof GeneratedFixDetailedDTO>> {
    const fix = await analysisRepo.getById(db, fixId);

    if (fix == null) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Fix not found",
      });
    }

    const cachedResult = await redis.get(REDIS_CONFIG.keys.fixResult(fixId));
    const parsedResult = FixResultSchema.safeParse(cachedResult);

    return fixesMapper.toDetailed(fix, parsedResult.success ? parsedResult.data : null);
  },

  async getByRepository(
    db: DbClient,
    repoId: string,
  ): Promise<Array<z.infer<typeof GeneratedFixDTO>>> {
    const fixes = await analysisRepo.getByRepoId(db, repoId);
    return fixes.map((fix) => fixesMapper.toPublic(fix));
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
      where: { id: input.repoId },
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
      repoId: repo.id,
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
        fixId: fix.id,
        owner: repo.owner,
        repoId: repo.id,
        repoName: repo.name,
        title: input.title,
      });

      await analysisRepo.updateStatus(db, fix.id, "PR_OPENED", {
        githubPrNumber: result.prNumber,
        githubPrUrl: result.prUrl,
      });

      await redis.del(cacheKey);

      return {
        fixId: fix.id,
        prNumber: result.prNumber,
        prUrl: result.prUrl,
        success: true,
      };
    } catch (error) {
      appLogger.error({
        error: error instanceof Error ? error.message : String(error),
        fixId: fix.id,
        msg: "staged_pr_open_failed",
        repoId: input.repoId,
      });

      await analysisRepo.updateStatus(db, fix.id, "FAILED");

      if (error instanceof TRPCError) {
        throw error;
      }

      return {
        error: error instanceof Error ? error.message : "Unknown error",
        success: false,
      };
    }
  },
};
