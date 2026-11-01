import { schedules } from "@trigger.dev/sdk";

import { TASK_CONFIGS } from "@/server/utils/task-config";

import { runStripeReconciliation } from "../billing.reconciliation";

export const reconcileStripeTask = schedules.task({
  cron: "17 4 * * *",
  id: "billing-reconcile-stripe",
  ...TASK_CONFIGS.reconcileStripe,
  run: async () => runStripeReconciliation(),
});
