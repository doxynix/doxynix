import { task } from "@trigger.dev/sdk/v3";

import { REALTIME_CONFIG } from "@/shared/constants/realtime";

import { realtimeServer } from "@/server/shared/infrastructure/realtime";
import { redisClient } from "@/server/shared/infrastructure/redis";

import { runQuickFileAudit, type FileActionNodeContext } from "../model/file-actions";
import { toQuickFileAuditPreview } from "../model/repo-file-action-preview";
import type { SyncFileActionMeta } from "../model/repo-file-action-state";

export const analyzeFileTask = task({
  id: "analyze-single-file",
  run: async (payload: {
    analysisId?: string;
    commitSha?: string;
    content: string;
    language: string;
    nodeContext?: FileActionNodeContext;
    path: string;
    syncMeta: SyncFileActionMeta;
    userId: number;
  }) => {
    const audit = await runQuickFileAudit(payload);

    const baseResult = toQuickFileAuditPreview({
      ...audit,
      ...payload.syncMeta,
    });

    const result = {
      ...baseResult,
      analysisId: payload.analysisId,
      commitSha: payload.commitSha,
    };

    const cacheKey = `file-result:${payload.userId}:${payload.path}`;
    await redisClient.set(cacheKey, result, { ex: 86_400 });

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
