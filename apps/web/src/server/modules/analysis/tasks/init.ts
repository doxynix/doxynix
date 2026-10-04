import { type FixStatus, PRAnalysisStatus, Status } from "@doxynix/shared";
import { locals, tasks } from "@trigger.dev/sdk";

import { REALTIME_CONFIG } from "@/shared/config/realtime";

import { appLogger } from "@/server/core/app-logger";
import { prisma } from "@/server/core/db";
import { trackServerEvent } from "@/server/core/posthog-events";
import { realtimeService } from "@/server/core/realtime";

const PrismaLocal = locals.create<typeof prisma>("prisma");

export function getTaskPrisma() {
  return locals.getOrThrow(PrismaLocal);
}

// Prevents "[object Object]" from reaching logs and the DB.
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

type PlatformFailureTrigger = "manual_cancel" | "platform_failure" | "task_timeout";

function readAnalysisId(payload: unknown): string | undefined {
  const value = (payload as Record<string, unknown> | null)?.analysisId;
  return value == null ? undefined : String(value);
}

async function emitPlatformFailure(input: {
  analysisId?: string;
  distinctId?: string;
  fixId?: string;
  stage: string;
  trigger: PlatformFailureTrigger;
}) {
  trackServerEvent(
    "repo_analysis_failed",
    {
      analysis_id: input.analysisId ?? null,
      // Platform timeouts have no reliable start time here; a null is filterable, a 0 would skew averages.
      duration_ms: null,
      fix_id: input.fixId ?? null,
      source: "platform",
      stage: input.stage,
      trigger: input.trigger,
    },
    input.distinctId,
  );
}

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
        where: { id: analysisId },
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
      const prAnalysisId = String(safePayload.prAnalysisId);

      const prAnalysis = await db.pullRequestAnalysis.update({
        data: {
          error: errorMsg,
          status: PRAnalysisStatus.FAILED,
        },
        include: { repo: { select: { userId: true } } },
        where: { id: prAnalysisId },
      });

      await emitPlatformFailure({
        analysisId: prAnalysisId,
        distinctId: prAnalysis.repo.userId,
        fixId: undefined,
        stage: "analyze_pr",
        trigger: "platform_failure",
      });
    }

    if (taskName === "generate-fix" && safePayload?.fixId != null) {
      const fixId = String(safePayload.fixId);

      const fix = await db.generatedFix.update({
        data: {
          status: "FAILED" as FixStatus,
        },
        include: { repo: { select: { userId: true } } },
        where: { id: fixId },
      });

      await emitPlatformFailure({
        analysisId: undefined,
        distinctId: fix.repo.userId,
        fixId,
        stage: "generate_fix",
        trigger: "platform_failure",
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

tasks.onComplete(async ({ ctx, payload, result }) => {
  if (result.ok) {
    return;
  }

  const errorMsg = formatTaskError(
    result.error,
    "Uncaught execution failure / Timeout on Trigger.dev",
  );

  await cleanupFailsafeDatabaseState(ctx.task.id, payload, errorMsg);

  await emitPlatformFailure({
    analysisId: readAnalysisId(payload),
    stage: String(ctx.task.id),
    trigger: "task_timeout",
  });
});

tasks.onCancel(async ({ ctx, payload }) => {
  const cancelReason = "Task execution manually cancelled on Trigger.dev Dashboard.";
  await cleanupFailsafeDatabaseState(ctx.task.id, payload, cancelReason);

  await emitPlatformFailure({
    analysisId: readAnalysisId(payload),
    stage: String(ctx.task.id),
    trigger: "manual_cancel",
  });
});

tasks.onFailure(async ({ ctx, error, payload }) => {
  const errorMsg = formatTaskError(error, "Something unexpected happened");
  await cleanupFailsafeDatabaseState(ctx.task.id, payload, errorMsg);

  await emitPlatformFailure({
    analysisId: readAnalysisId(payload),
    stage: String(ctx.task.id),
    trigger: "platform_failure",
  });
});
