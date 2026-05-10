import { task } from "@trigger.dev/sdk";
import { TRPCError } from "@trpc/server";

import { appLogger } from "@/server/core/app-logger";
import type { prisma } from "@/server/core/db";
import type { redisClient } from "@/server/core/redis";
import type { REDIS_CONFIG } from "@/server/utils/redis";

import { FixService } from "../logic/fix-generator";
import type { FindingForFix } from "../logic/pr-types";

export const generateFixTask = task({
  id: "generate-fix",
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

      await generatedFixService.updateStatus(prisma, payload.fixId, "GENERATING");

      // Create fix record (metadata only, no code/diffs stored)
      const fixResult = await fixService.createFixFromAnalysis({
        fileContents: payload.fileContents,
        findings: payload.findings,
        prAnalysisId: payload.prAnalysisId,
        repoContext: { language: repo.language ?? "typescript" },
        repoId: repo.id,
      });

      const cacheKey = REDIS_CONFIG.keys.fixResult(payload.fixId);
      await redisClient.set(cacheKey, fixResult, { ex: REDIS_CONFIG.ttl.fixResult });

      await generatedFixService.updateStatus(prisma, payload.fixId, "COMPLETED");

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

      await generatedFixService.updateStatus(prisma, payload.fixId, "FAILED");
      throw error;
    }
  },
});
