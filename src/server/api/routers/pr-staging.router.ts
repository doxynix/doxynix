import { TRPCError } from "@trpc/server";
import z from "zod";

import { generatedFixService } from "@/server/entities/pr-analysis/api/generated-fix.service";
import { FixService } from "@/server/features/pr-analysis/lib/fix-generator";
import { getClientContext } from "@/server/shared/infrastructure/github/github-provider";
import { logger } from "@/server/shared/infrastructure/logger";
import { REDIS_CONFIG } from "@/server/shared/lib/redis";

import { createTRPCRouter, protectedProcedure } from "../trpc";

const StagedFixedFileSchema = z.object({
  filePath: z.string().min(1),
  newContent: z.string().min(1),
});

export const prStagingRouter = createTRPCRouter({
  /**
   * Очищает корзину после создания PR.
   */
  clearStaging: protectedProcedure
    .input(z.object({ repoId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const cacheKey = REDIS_CONFIG.keys.prStaging(ctx.session.user.id, input.repoId);
      await ctx.redis.del(cacheKey);
      return { success: true };
    }),

  /**
   * Получает все текущие изменения для создания PR.
   */
  getStagedFiles: protectedProcedure
    .input(z.object({ repoId: z.string() }))
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

  openPullRequest: protectedProcedure
    .input(
      z.object({
        branch: z.string().min(1),
        repoId: z.string(),
        title: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      logger.info({
        branch: input.branch,
        msg: "staged_pr_open_requested",
        repoId: input.repoId,
        userId: ctx.session.user.id,
      });

      const cacheKey = REDIS_CONFIG.keys.prStaging(ctx.session.user.id, input.repoId);
      const staged = await ctx.redis.hgetall<Record<string, string>>(cacheKey);

      if (staged == null || Object.keys(staged).length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No staged files available for pull request creation",
        });
      }

      const repo = await ctx.db.repo.findUnique({
        where: { publicId: input.repoId },
      });

      if (repo == null) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Repository not found",
        });
      }

      const clientContext = await getClientContext(ctx.db, Number(ctx.session.user.id), repo.owner);

      const fix = await generatedFixService.create(ctx.prisma, {
        branch: input.branch,
        createdByUser: true,
        description: "Workspace staged changes opened through PR Draft.",
        repoId: repo.publicId,
        title: input.title,
      });

      try {
        const fixService = new FixService();
        const result = await fixService.applyFix(clientContext.octokit, {
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

        await generatedFixService.updateStatus(ctx.db, fix.publicId, "PR_OPENED", {
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
        logger.error({
          error: error instanceof Error ? error.message : String(error),
          fixId: fix.publicId,
          msg: "staged_pr_open_failed",
          repoId: input.repoId,
        });

        await generatedFixService.updateStatus(ctx.db, fix.publicId, "FAILED");

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
   * Добавляет файл в "корзину" изменений репозитория в Redis.
   * Ключ: pr-stage:{userId}:{repoId}
   */
  stageFile: protectedProcedure
    .input(
      z.object({
        content: z.string(),
        filePath: z.string(),
        repoId: z.string(),
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
        repoId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const fix = await generatedFixService.getById(ctx.db, input.fixId);
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
        repoId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const cacheKey = REDIS_CONFIG.keys.prStaging(ctx.session.user.id, input.repoId);

      await ctx.redis.hdel(cacheKey, input.filePath);
      const stagedCount = await ctx.redis.hlen(cacheKey);

      return { stagedCount, success: true };
    }),
});
