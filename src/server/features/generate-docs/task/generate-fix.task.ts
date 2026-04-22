import { task } from "@trigger.dev/sdk/v3";
import { TRPCError } from "@trpc/server";

import { generatedFixService } from "@/server/entities/pr-analysis/api/generated-fix.service";
import { prisma } from "@/server/shared/infrastructure/db";
import { logger } from "@/server/shared/infrastructure/logger";
import { redisClient } from "@/server/shared/infrastructure/redis";
import { REDIS_CONFIG } from "@/server/shared/lib/redis";

import { FixService } from "../../pr-analysis/lib/fix-generator";
import type { FindingForFix } from "../../pr-analysis/model/pr-types";

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

      logger.info({
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
