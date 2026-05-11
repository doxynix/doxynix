import { task } from "@trigger.dev/sdk";

import { REALTIME_CONFIG } from "@/shared/constants/realtime";

import { realtimeServer } from "@/server/core/realtime";
import { redisClient } from "@/server/core/redis";
import { REDIS_CONFIG } from "@/server/utils/redis";

import type { FileActionNodeContext } from "../analysis.schemas";
import { repoAnalysisService } from "../analysis.service";
import { toDocumentFilePreview } from "../logic/repo-file-action-preview";
import type { SyncFileActionMeta } from "../logic/repo-file-action-state";

export const documentFileTask = task({
  id: "document-single-file",
  run: async (payload: {
    analysisId?: string;
    commitSha?: string;
    content: string;
    language: string;
    nodeContext?: FileActionNodeContext;
    path: string;
    repoId: string;
    syncMeta: SyncFileActionMeta;
    userId: number;
  }) => {
    const documentedCode = await repoAnalysisService.runDocumentFilePreview(payload);

    const result = toDocumentFilePreview({
      ...documentedCode,
      ...payload.syncMeta,
    });

    const cacheKey = REDIS_CONFIG.keys.fileAction(
      payload.userId,
      payload.path,
      "document-file-preview"
    );
    await redisClient.set(cacheKey, result, { ex: REDIS_CONFIG.ttl.fileAction });

    const channelName = REALTIME_CONFIG.channels.user(payload.userId);
    await realtimeServer.channels
      .get(channelName)
      .publish(REALTIME_CONFIG.events.user.fileActionCompleted, {
        path: payload.path,
        type: "DOCUMENTATION",
      });

    return result;
  },
});
