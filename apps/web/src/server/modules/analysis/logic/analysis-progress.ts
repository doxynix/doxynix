import { Status } from "@doxynix/shared";

import { REALTIME_CONFIG } from "@/shared/config/realtime";
import { TRIGGER_CONFIG } from "@/shared/config/trigger";

import { prisma } from "@/server/core/db";
import { realtimeService } from "@/server/core/realtime";
import { currentTaskMetadata, taskLogger } from "@/server/utils/task-logger";

async function publishAnalysisProgress(params: {
  analysisId: string;
  message: string;
  progress: number;
  status: Status;
  userId: string;
}) {
  await realtimeService.user(params.userId).publish(REALTIME_CONFIG.events.user.analysisProgress, {
    analysisId: params.analysisId,
    message: params.message,
    progress: params.progress,
    status: params.status,
  });
}

export const analysisProgress = {
  async finalize(analysisId: string, status: Status = Status.DONE, message?: string) {
    const finalMsg =
      message ?? (status === Status.DONE ? "Completed successfully" : "Analysis failed");

    taskLogger.log(
      `Analysis finalized with status: ${status}`,
      status === Status.DONE ? "success" : "error",
    );

    const currentMetadata = currentTaskMetadata();
    const rawLogs = currentMetadata?.[TRIGGER_CONFIG.metadataKeys.taskLogs];
    const allLogs = Array.isArray(rawLogs) ? rawLogs.join("\n") : "";

    const analysis = await prisma.analysis.update({
      data: {
        logs: allLogs,
        message: finalMsg,
        progress: 100,
        status,
      },
      select: { repo: { select: { userId: true } } },
      where: { id: analysisId },
    });

    await publishAnalysisProgress({
      analysisId,
      message: finalMsg,
      progress: 100,
      status,
      userId: analysis.repo.userId,
    });
  },

  async milestone(params: { analysisId: string; msg: string; percent: number; userId: string }) {
    const { analysisId, msg, percent, userId } = params;

    taskLogger.info(`STAGE: ${msg} (${percent}%)`);

    taskLogger.setStatusMessage(msg);
    taskLogger.setProgress(percent);

    await publishAnalysisProgress({
      analysisId,
      message: msg,
      progress: percent,
      status: Status.PENDING,
      userId,
    });
  },
};
