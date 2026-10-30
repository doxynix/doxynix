import { schedules } from "@trigger.dev/sdk";

import { appLogger } from "@/server/core/app-logger";
import { purgeBillingEventPayloads } from "@/server/core/billing/purge";
import { prisma } from "@/server/core/db";
import { TASK_CONFIGS } from "@/server/utils/task-config";

export const dailyDatabaseMaintenance = schedules.task({
  cron: "0 3 * * *",
  id: "daily-database-maintenance",
  ...TASK_CONFIGS.dailyDatabaseMaintenance,
  run: async (payload) => {
    appLogger.info({
      msg: "Starting global database maintenance...",
      timestamp: payload.timestamp,
    });

    const now = new Date();
    const date14DaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    try {
      const deletedTokens = await prisma.verification.deleteMany({
        where: { expiresAt: { lt: now } },
      });
      const deletedSessions = await prisma.session.deleteMany({
        where: { expiresAt: { lt: now } },
      });

      const deletedWebhooks = await prisma.webhookDelivery.deleteMany({
        where: { createdAt: { lt: date14DaysAgo } },
      });

      // The payload holds PII; the row and its stripeEventId stay forever for deduplication.
      const purgedBillingPayloads = await purgeBillingEventPayloads(prisma, now);

      appLogger.info({
        deletedSessionsCount: deletedSessions.count,
        deletedTokensCount: deletedTokens.count,
        deletedWebhookLogsCount: deletedWebhooks.count,
        msg: "Database cleanup completed successfully.",
        purgedBillingPayloads,
      });

      return {
        deletedSessions: deletedSessions.count,
        deletedTokens: deletedTokens.count,
        deletedWebhooks: deletedWebhooks.count,
        purgedBillingPayloads,
        success: true,
      };
    } catch (error) {
      appLogger.error({
        error: error instanceof Error ? error.message : String(error),
        msg: "Failed to execute database cleanup task",
      });
      throw error;
    }
  },
});
