import { Status } from "@doxynix/shared";

import { REALTIME_CONFIG } from "@/shared/config/realtime";

import { appLogger } from "@/server/core/app-logger";
import { prisma } from "@/server/core/db";
import { realtimeService } from "@/server/core/realtime";

import { cleanup } from "./utils"; // Import the bare cleanup from utilities

export async function handleError(
  error: unknown,
  analysisId: string,
  channelName: string,
  tempPath: string,
) {
  const message = error instanceof Error ? error.message : "Unknown error";
  appLogger.error({
    analysisId,
    error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
    msg: "TASK_ERROR",
  });

  await cleanup(tempPath);

  await prisma.analysis.update({
    data: {
      error: message,
      message: "Analysis failed",
      status: Status.FAILED,
    },
    where: { publicId: analysisId },
  });

  await realtimeService.channel(channelName).publish(REALTIME_CONFIG.events.user.analysisProgress, {
    analysisId,
    message,
    status: Status.FAILED,
  });
}
