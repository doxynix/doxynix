import { task } from "@trigger.dev/sdk";

import { REALTIME_CONFIG } from "@/shared/constants/realtime";

import { realtimeService } from "@/server/core/realtime";
import { redisService } from "@/server/core/redis";
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

    await redisService.fileActions.set(payload.userId, payload.path, "quick-file-audit", result);

    await realtimeService
      .user(payload.userId)
      .publish(REALTIME_CONFIG.events.user.fileActionCompleted, {
        path: payload.path,
        type: "AUDIT",
      });

    return result;
  },
});
