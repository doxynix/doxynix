import { task } from "@trigger.dev/sdk/v3";
import { TRPCError } from "@trpc/server";

import { generatedFixService } from "@/server/entities/pr-analysis/api/generated-fix.service";
import { prisma } from "@/server/shared/infrastructure/db";
import { logger } from "@/server/shared/infrastructure/logger";
import { redisClient } from "@/server/shared/infrastructure/redis";

import { FixService } from "../../pr-analysis/lib/fix-generator";
import type { FindingForFix } from "../../pr-analysis/model/pr-types";

export const generateFixTask = task({
  id: "generate-fix",
  run: async (payload: {
    fileContents: Record<string, string>;
    findings: FindingForFix[];
    fixId: number;
    prAnalysisId?: string;
    repoId: number;
  }) => {
    const fixService = new FixService();

    try {
      const repo = await prisma.repo.findUnique({
        where: { id: payload.repoId },
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
        repoId: payload.repoId,
      });

      const cacheKey = `fix-result:${payload.fixId}`;
      await redisClient.set(cacheKey, fixResult, { ex: 86_000 });

      await generatedFixService.updateStatus(prisma, payload.fixId, "COMPLETED");

      logger.info({
        fixId: payload.fixId,
        msg: "fix_created",
        repoId: payload.repoId,
      });

      return { fixId: payload.fixId, success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const cacheKey = `fix-result:${payload.fixId}`;
      await redisClient.set(cacheKey, { error: errorMsg }, { ex: 86_000 });

      await generatedFixService.updateStatus(prisma, payload.fixId, "FAILED");
      throw error;
    }
  },
});
