import { task } from "@trigger.dev/sdk";

import { TASK_CONFIGS } from "@/server/utils/task-config";

export type ProcessStripeEventPayload = {
  billingEventId: string;
};

export const processStripeEventTask = task({
  id: "billing-process-stripe-event",
  ...TASK_CONFIGS.processStripeEvent,
  // BILL-08 replaces this body with the canonical Stripe retrieve, projection and ledger writes.
  run: async (payload: ProcessStripeEventPayload) => {
    return { billingEventId: payload.billingEventId };
  },
});
