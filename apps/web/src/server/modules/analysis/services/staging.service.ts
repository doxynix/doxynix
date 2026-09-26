import { TRPCError } from "@trpc/server";
import type { Redis } from "@upstash/redis";
import * as z from "zod";

import type { DbClient } from "@/server/core/db";
import { redisService } from "@/server/core/redis";
import { REDIS_CONFIG } from "@/server/utils/redis";

import { StagedFixedFileSchema } from "../analysis.schemas";

const StagedFixResultSchema = z.object({
  fixedFiles: z.array(StagedFixedFileSchema).min(1),
});

/**
 * The per-user staging area that accumulates file contents until the user opens
 * a pull request. Backed by a single Redis hash: `pr-stage:{userId}:{repoId}`.
 */
export const stagingService = {
  /**
   * Clears the staging area after creating a PR.
   */
  async clearStaging(userId: string, repoId: string) {
    await redisService.staging.clear(userId, repoId);
    return { success: true };
  },

  /**
   * Gets all currently staged changes for creating a PR.
   */
  async getStagedFiles(userId: string, repoId: string) {
    return redisService.staging.getAll(userId, repoId);
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
