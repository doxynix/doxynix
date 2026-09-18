import { Status } from "@doxynix/shared";
import { metadata } from "@trigger.dev/sdk";

import { REALTIME_CONFIG } from "@/shared/config/realtime";
import { TRIGGER_CONFIG } from "@/shared/config/trigger";

import { appLogger } from "@/server/core/app-logger";
import { prisma } from "@/server/core/db";
import { realtimeService } from "@/server/core/realtime";

type LogLevel = "error" | "info" | "success" | "warn";

function safeMetadata(action: () => void) {
  try {
    action();
  } catch (error) {
    appLogger.debug({ error, msg: "Trigger metadata unavailable; skipping realtime update" });
  }
}

function safeCurrentMetadata() {
  try {
    return metadata.current();
  } catch (error) {
    appLogger.debug({ error, msg: "Trigger metadata unavailable; reading empty metadata" });
    return undefined;
  }
}

/**
 * Utility for managing task progress and logs.
 * Separates the real-time stream (metadata) from permanent storage (DB).
 */
export const taskLogger = {
  error(msg: string) {
    this.log(msg, "error");
  },
  /**
   * Final sync. Called once at the end.
   * Collects ALL logs from metadata and stores them in the DB permanently.
   */
  async finalize(analysisId: string, status: Status = Status.DONE, message?: string) {
    const finalMsg =
      message ?? (status === Status.DONE ? "Completed successfully" : "Analysis failed");

    this.log(
      `Analysis finalized with status: ${status}`,
      status === Status.DONE ? "success" : "error",
    );

    const currentMetadata = safeCurrentMetadata();

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
      where: { publicId: analysisId },
    });

    await publishAnalysisProgress({
      analysisId,
      message: finalMsg,
      progress: 100,
      status,
      userId: analysis.repo.userId,
    });
  },
  /**
   * Helpers for different log levels
   */
  info(msg: string) {
    this.log(msg, "info");
  },
  /**
   * Granular log. Only for real-time display.
   * Line format: "level:::timestamp:::message"
   */
  log(msg: string, level: LogLevel = "info") {
    const timestamp = new Date().toLocaleTimeString();
    const line = `${level}:::${timestamp}:::${msg}`;

    appLogger.info({ msg: `[${level.toUpperCase()}] [${timestamp}] ${msg}` });

    safeMetadata(() => metadata.append(TRIGGER_CONFIG.metadataKeys.taskLogs, line));
  },

  /**
   * Updates the current stage status.
   */
  async milestone(params: { analysisId: string; msg: string; percent: number; userId: number }) {
    const { analysisId, msg, percent, userId } = params;

    this.info(`STAGE: ${msg} (${percent}%)`);

    safeMetadata(() => metadata.set(TRIGGER_CONFIG.metadataKeys.statusMessage, msg));
    safeMetadata(() => metadata.set(TRIGGER_CONFIG.metadataKeys.progress, percent));

    await publishAnalysisProgress({
      analysisId,
      message: msg,
      progress: percent,
      status: Status.PENDING,
      userId,
    });
  },

  success(msg: string) {
    this.log(msg, "success");
  },

  warn(msg: string) {
    this.log(msg, "warn");
  },
};

async function publishAnalysisProgress(params: {
  analysisId: string;
  message: string;
  progress: number;
  status: Status;
  userId: number;
}) {
  await realtimeService.user(params.userId).publish(REALTIME_CONFIG.events.user.analysisProgress, {
    analysisId: params.analysisId,
    message: params.message,
    progress: params.progress,
    status: params.status,
  });
}
