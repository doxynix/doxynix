import { schedules } from "@trigger.dev/sdk";

import { TASK_CONFIGS } from "@/server/utils/task-config";

import { sweepStaleStripeEvents } from "../billing.events";

export const sweepStripeEventsTask = schedules.task({
  cron: { pattern: "*/15 * * * *", window: "5m" },
  id: "billing-sweep-stripe-events",
  ...TASK_CONFIGS.sweepStripeEvents,
  run: async () => sweepStaleStripeEvents(),
});
