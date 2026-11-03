import { schedules } from "@trigger.dev/sdk";

import { appLogger } from "@/server/core/app-logger";
import { prisma } from "@/server/core/db";
import { purgeExpiredHistory } from "@/server/core/history/retention";
import { TASK_CONFIGS } from "@/server/utils/task-config";

export const historyRetentionTask = schedules.task({
  cron: "45 3 * * *",
  id: "history-retention",
  ...TASK_CONFIGS.historyRetention,
  run: async (payload) => {
    const summary = await purgeExpiredHistory(prisma, payload.timestamp);

    appLogger.info({ ...summary, msg: "History retention completed." });

    return summary;
  },
});
