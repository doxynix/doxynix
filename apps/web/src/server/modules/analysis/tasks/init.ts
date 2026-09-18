import { type FixStatus, PRAnalysisStatus, Status } from "@doxynix/shared";
import { locals, tasks } from "@trigger.dev/sdk";

import { REALTIME_CONFIG } from "@/shared/config/realtime";

import { appLogger } from "@/server/core/app-logger";
import { prisma } from "@/server/core/db";
import { realtimeService } from "@/server/core/realtime";

const PrismaLocal = locals.create<typeof prisma>("prisma");

export function getTaskPrisma() {
  return locals.getOrThrow(PrismaLocal);
}

/**
 * Universal mini-helper for safe and consistent error parsing.
 * Prevents "[object Object]" from appearing in logs and the DB.
 */
function formatTaskError(error: unknown, defaultMessage: string): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }
  if (error != null && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return defaultMessage;
}

tasks.middleware("prisma-connection-manager", async ({ ctx, next }) => {
  locals.set(PrismaLocal, prisma);

  try {
    appLogger.debug({ msg: "[Prisma Middleware] Connecting to PostgreSQL...", runId: ctx.run.id });
    await prisma.$connect();
    await next();
  } finally {
    appLogger.debug({
      msg: "[Prisma Middleware] Releasing PostgreSQL connection...",
      runId: ctx.run.id,
    });
    await prisma.$disconnect();
  }
});

tasks.onWait("prisma-connection-manager", async ({ ctx }) => {
  appLogger.debug({
    msg: "[Prisma Middleware] Task paused. Releasing database connection (onWait)...",
    runId: ctx.run.id,
  });
  await prisma.$disconnect();
});

tasks.onResume("prisma-connection-manager", async ({ ctx }) => {
  appLogger.debug({
    msg: "[Prisma Middleware] Task resumed. Reconnecting to database (onResume)...",
    runId: ctx.run.id,
  });
  await prisma.$connect();
});

tasks.onStartAttempt(({ ctx }) => {
  appLogger.info({
    attempt: ctx.attempt.number,
    msg: `[Trigger.dev] Starting execution of task ${ctx.task.id} (Attempt #${ctx.attempt.number})`,
    runId: ctx.run.id,
    task: ctx.task.id,
  });
});

/**
 * Single helper method to reset stuck database statuses after an abortive termination
 */
async function cleanupFailsafeDatabaseState(taskName: string, payload: unknown, errorMsg: string) {
  const safePayload = payload as null | Record<string, unknown>;

  try {
    let db = prisma;
    try {
      db = getTaskPrisma();
    } catch {
      appLogger.debug({
        msg: "[Failsafe Cleanup] Locals out of scope, falling back to global Prisma singleton",
      });
    }

    if (taskName === "analyze-repo" && safePayload?.analysisId != null) {
      const analysisId = String(safePayload.analysisId);

      const updated = await db.analysis.update({
        data: {
          error: errorMsg,
          status: Status.FAILED,
        },
        include: {
          repo: {
            select: { userId: true },
          },
        },
        where: { publicId: analysisId },
      });

      await realtimeService
        .user(updated.repo.userId)
        .publish(REALTIME_CONFIG.events.user.analysisProgress, {
          analysisId,
          message: `Task aborted on platform: ${errorMsg.slice(0, 80)}...`,
          progress: 100,
          status: "FAILED",
        });
    }

    if (taskName === "analyze-pr" && safePayload?.analysisId != null) {
      const prAnalysisId = Number(safePayload.analysisId);

      await db.pullRequestAnalysis.update({
        data: {
          error: errorMsg,
          status: PRAnalysisStatus.FAILED,
        },
        where: { id: prAnalysisId },
      });
    }

    if (taskName === "generate-fix" && safePayload?.fixId != null) {
      const fixId = String(safePayload.fixId);

      await db.generatedFix.update({
        data: {
          status: "FAILED" as FixStatus,
        },
        where: { publicId: fixId },
      });

      appLogger.info({
        fixId,
        msg: "[Failsafe Cleanup] Reset cancelled/failed AI Fix status to FAILED",
      });
    }
  } catch (dbError) {
    appLogger.error({
      dbError: dbError instanceof Error ? dbError.message : String(dbError),
      msg: `[Failsafe Cleanup Failed] Could not reset database status for task ${taskName}`,
    });
  }
}

/**
 * Hook on task completion (errors, timeouts, retries exhausted)
 */
tasks.onComplete(async ({ ctx, payload, result }) => {
  if (result.ok) {
    return;
  }

  const errorMsg = formatTaskError(
    result.error,
    "Uncaught execution failure / Timeout on Trigger.dev",
  );

  await cleanupFailsafeDatabaseState(ctx.task.id, payload, errorMsg);
});

/**
 * Hook for a hard manual task cancellation by the user in the dashboard (onCancel)
 */
tasks.onCancel(async ({ ctx, payload }) => {
  const cancelReason = "Task execution manually cancelled on Trigger.dev Dashboard.";
  await cleanupFailsafeDatabaseState(ctx.task.id, payload, cancelReason);
});

/**
 * Hook for critical failures of task execution attempts
 */
tasks.onFailure(async ({ ctx, error, payload }) => {
  const errorMsg = formatTaskError(error, "Something unexpected happened");
  await cleanupFailsafeDatabaseState(ctx.task.id, payload, errorMsg);
});
