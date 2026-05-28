import { logger, schedules } from "@trigger.dev/sdk/v3";

import { appLogger } from "@/server/core/app-logger";
import { prisma } from "@/server/core/db";

/**
 * Единая комплексная задача ежедневного обслуживания и очистки СУБД
 */
export const dailyDatabaseMaintenance = schedules.task({
  cron: "0 3 * * *",
  id: "daily-database-maintenance",
  run: async (payload) => {
    logger.info("Starting global database maintenance...", { timestamp: payload.timestamp });

    const now = new Date();

    const date14DaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    try {
      const deletedTokens = await prisma.verificationToken.deleteMany({
        where: { expires: { lt: now } },
      });
      const deletedSessions = await prisma.session.deleteMany({
        where: { expires: { lt: now } },
      });

      const deletedWebhooks = await prisma.webhookDelivery.deleteMany({
        where: { createdAt: { lt: date14DaysAgo } },
      });

      appLogger.info({
        deletedSessionsCount: deletedSessions.count,
        deletedTokensCount: deletedTokens.count,
        deletedWebhookLogsCount: deletedWebhooks.count,
        msg: "Database cleanup completed successfully.",
      });

      return {
        deletedSessions: deletedSessions.count,
        deletedTokens: deletedTokens.count,
        deletedWebhooks: deletedWebhooks.count,
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
