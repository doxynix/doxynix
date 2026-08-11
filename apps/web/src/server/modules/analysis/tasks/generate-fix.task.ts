import { task } from "@trigger.dev/sdk";
import { TRPCError } from "@trpc/server";
import { uniq } from "es-toolkit";

import { appLogger } from "@/server/core/app-logger";
import { prisma } from "@/server/core/db";
import { githubBrowseService } from "@/server/core/github/github-browse.service";
import { redisClient } from "@/server/core/redis";
import { REDIS_CONFIG } from "@/server/utils/redis";
import { TASK_CONFIGS } from "@/server/utils/task-config";

import { analysisRepo } from "../analysis.repository";
import { FixService } from "../logic/fix-generator";
import type { FindingForFix } from "../logic/pr-types";

export const generateFixTask = task({
  id: "generate-fix",
  ...TASK_CONFIGS.generateFix,
  run: async (payload: {
    fileContents: Record<string, string>;
    findings: FindingForFix[];
    fixId: string;
    prAnalysisId?: string;
    repoId: string;
    userId: number;
  }) => {
    const fixService = new FixService();

    try {
      const repo = await prisma.repo.findUnique({
        where: { publicId: payload.repoId },
      });

      if (repo == null) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Repository not found",
        });
      }

      await analysisRepo.updateStatus(prisma, payload.fixId, "GENERATING");

      const fileContents = { ...payload.fileContents };
      const uniqueFiles = uniq(payload.findings.map((f) => f.file));

      let targetBranch = repo.defaultBranch;
      if (payload.prAnalysisId != null) {
        const prAnalysis = await prisma.pullRequestAnalysis.findUnique({
          select: { headSha: true },
          where: { publicId: payload.prAnalysisId },
        });
        if (prAnalysis != null) {
          targetBranch = prAnalysis.headSha;
        }
      }

      for (const filePath of uniqueFiles) {
        if (fileContents[filePath] == null || fileContents[filePath].length === 0) {
          appLogger.info({
            filePath,
            msg: "Autofetching file content from GitHub for fix task",
            repoId: repo.id,
          });
          try {
            const githubFile = await githubBrowseService.getFileContent(
              prisma,
              prisma,
              payload.userId,
              repo.publicId,
              filePath,
              targetBranch
            );
            fileContents[filePath] = githubFile.content;
          } catch (fetchError) {
            appLogger.error({
              error: fetchError,
              filePath,
              msg: "Failed to autodetect and fetch file content from GitHub",
            });
            throw new Error(`Failed to retrieve file ${filePath} from GitHub repository.`);
          }
        }
      }

      const fixResult = await fixService.createFixFromAnalysis({
        fileContents,
        findings: payload.findings,
        prAnalysisId: payload.prAnalysisId,
        repoContext: { language: repo.language ?? "typescript" },
        repoId: repo.id,
      });

      const cacheKey = REDIS_CONFIG.keys.fixResult(payload.fixId);
      await redisClient.set(cacheKey, fixResult, { ex: REDIS_CONFIG.ttl.fixResult });

      await analysisRepo.updateStatus(prisma, payload.fixId, "COMPLETED");

      appLogger.info({
        fixId: payload.fixId,
        msg: "fix_created",
        repoId: payload.repoId,
      });

      return { fixId: payload.fixId, success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const cacheKey = REDIS_CONFIG.keys.fixResult(payload.fixId);
      await redisClient.set(cacheKey, { error: errorMsg }, { ex: REDIS_CONFIG.ttl.fixResult });

      await analysisRepo.updateStatus(prisma, payload.fixId, "FAILED");
      throw error;
    }
  },
});
