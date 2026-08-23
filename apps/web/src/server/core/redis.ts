import { Redis } from "@upstash/redis";

import { REDIS_CONFIG } from "@/server/utils/redis";
import type { FileActionPreviewResult, StagedFile } from "@/server/utils/types";

import { appLogger } from "./app-logger";

export const redisClient = Redis.fromEnv();

async function safeRedis<T>(
  operation: () => Promise<T>,
  options: {
    fallback?: T;
    meta?: Record<string, unknown>;
    msg: string;
    rethrow?: boolean;
  }
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    appLogger.error({
      error: error instanceof Error ? error.message : String(error),
      msg: options.msg,
      ...options.meta,
    });
    if (options.rethrow === true) throw error;
    return options.fallback as T;
  }
}

export const redisService = {
  authStorage: {
    delete: (key: string): Promise<void> =>
      safeRedis(
        async () => {
          await redisClient.del(key);
        },
        {
          meta: { key },
          msg: "Redis secondaryStorage delete error",
          rethrow: true,
        }
      ),

    get: (key: string): Promise<null | string> =>
      safeRedis(
        async () => {
          const value = await redisClient.get(key);
          if (value == null) return null;
          return typeof value === "string" ? value : JSON.stringify(value);
        },
        {
          fallback: null,
          meta: { key },
          msg: "Redis secondaryStorage get error",
          rethrow: true,
        }
      ),

    getAndDelete: (key: string): Promise<null | string> =>
      safeRedis(
        async () => {
          const value = await redisClient.getdel<string>(key);
          if (value == null) return null;
          return typeof value === "string" ? value : JSON.stringify(value);
        },
        {
          fallback: null,
          meta: { key },
          msg: "Redis secondaryStorage getAndDelete error",
          rethrow: true,
        }
      ),

    set: (key: string, value: unknown, ttl?: number): Promise<void> =>
      safeRedis(
        async () => {
          const stringValue = typeof value === "string" ? value : JSON.stringify(value);
          if (ttl != null) {
            await redisClient.set(key, stringValue, { ex: ttl });
          } else {
            await redisClient.set(key, stringValue);
          }
        },
        { meta: { key }, msg: "Redis secondaryStorage set error", rethrow: true }
      ),
  },

  fileActions: {
    get: (
      userId: number | string,
      path: string,
      action: "document-file-preview" | "quick-file-audit"
    ) =>
      safeRedis(
        () =>
          redisClient.get<FileActionPreviewResult>(
            REDIS_CONFIG.keys.fileAction(userId, path, action)
          ),
        { fallback: null, meta: { path, userId }, msg: "Redis fileActions.get failed" }
      ),

    set: (
      userId: number | string,
      path: string,
      action: "document-file-preview" | "quick-file-audit",
      data: FileActionPreviewResult
    ) =>
      safeRedis(
        () =>
          redisClient.set(REDIS_CONFIG.keys.fileAction(userId, path, action), data, {
            ex: REDIS_CONFIG.ttl.fileAction,
          }),
        { meta: { path, userId }, msg: "Redis fileActions.set failed", rethrow: true }
      ),
  },

  fixes: {
    get: (fixId: string) =>
      safeRedis(() => redisClient.get(REDIS_CONFIG.keys.fixResult(fixId)), {
        fallback: null,
        meta: { fixId },
        msg: "Redis fixes.get failed",
      }),

    set: (fixId: string, result: unknown) =>
      safeRedis(
        () =>
          redisClient.set(REDIS_CONFIG.keys.fixResult(fixId), result, {
            ex: REDIS_CONFIG.ttl.fixResult,
          }),
        { meta: { fixId }, msg: "Redis fixes.set failed", rethrow: true }
      ),
  },

  staging: {
    addFiles: (userId: number | string, repoId: string, entries: Record<string, string>) =>
      safeRedis(
        async () => {
          const key = REDIS_CONFIG.keys.prStaging(userId, repoId);
          await redisClient.hset(key, entries);
          await redisClient.expire(key, REDIS_CONFIG.ttl.prStaging);
          return await redisClient.hlen(key);
        },
        {
          fallback: 0,
          meta: { repoId, userId },
          msg: "Redis staging.addFiles failed",
          rethrow: true,
        }
      ),

    clear: (userId: number | string, repoId: string) =>
      safeRedis(() => redisClient.del(REDIS_CONFIG.keys.prStaging(userId, repoId)), {
        meta: { repoId, userId },
        msg: "Redis staging.clear failed",
        rethrow: true,
      }),

    getAll: (userId: number | string, repoId: string): Promise<StagedFile[]> =>
      safeRedis(
        async () => {
          const key = REDIS_CONFIG.keys.prStaging(userId, repoId);
          const staged = await redisClient.hgetall<Record<string, string>>(key);
          if (staged == null || Object.keys(staged).length === 0) return [];
          return Object.entries(staged).map(([filePath, content]) => ({ content, filePath }));
        },
        { fallback: [], meta: { repoId, userId }, msg: "Redis staging.getAll failed" }
      ),

    removeFile: (userId: number | string, repoId: string, filePath: string) =>
      safeRedis(
        async () => {
          const key = REDIS_CONFIG.keys.prStaging(userId, repoId);
          await redisClient.hdel(key, filePath);
          return await redisClient.hlen(key);
        },
        {
          fallback: 0,
          meta: { filePath, repoId, userId },
          msg: "Redis staging.removeFile failed",
          rethrow: true,
        }
      ),
  },
};
