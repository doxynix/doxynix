import { task } from "@trigger.dev/sdk";

import { REALTIME_CONFIG } from "@/shared/constants/realtime";

import { realtimeServer } from "@/server/core/realtime";
import { redisClient } from "@/server/core/redis";
import { REDIS_CONFIG } from "@/server/utils/redis";
import { TASK_CONFIGS } from "@/server/utils/task-config";

import type { FileActionNodeContext } from "../analysis.schemas";
import { runQuickFileAudit } from "../analysis.utils";
import { toQuickFileAuditPreview } from "../logic/repo-file-action-preview";
import type { SyncFileActionMeta } from "../logic/repo-file-action-state";

export const analyzeFileTask = task({
  id: "analyze-single-file",
  ...TASK_CONFIGS.analyzeSingleFile,
  run: async (payload: {
    analysisId?: string;
    branch: string;
    commitSha?: string;
    content: string;
    language: string;
    nodeContext?: FileActionNodeContext;
    path: string;
    repoId: string;
    syncMeta: SyncFileActionMeta;
    userId: number;
  }) => {
    const audit = await runQuickFileAudit(payload.userId, payload);

    const baseResult = toQuickFileAuditPreview({
      ...audit,
      ...payload.syncMeta,
    });

    const result = {
      ...baseResult,
      analysisId: payload.analysisId,
      commitSha: payload.commitSha,
    };

    const cacheKey = REDIS_CONFIG.keys.fileAction(payload.userId, payload.path, "quick-file-audit");
    await redisClient.set(cacheKey, result, { ex: REDIS_CONFIG.ttl.fileAction });

    const channelName = REALTIME_CONFIG.channels.user(payload.userId);
    await realtimeServer.channels
      .get(channelName)
      .publish(REALTIME_CONFIG.events.user.fileActionCompleted, {
        path: payload.path,
        type: "AUDIT",
      });

    return result;
  },
});
