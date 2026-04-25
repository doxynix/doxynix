import z from "zod";

import { REDIS_CONFIG } from "@/server/shared/lib/redis";

import { createTRPCRouter, protectedProcedure } from "../trpc";

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
      const staged = await ctx.redis.get<Record<string, string>>(cacheKey);

      if (staged === null) {
        return [];
      }

      return Object.entries(staged).map(([filePath, content]) => ({
        content,
        filePath,
      }));
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
});
