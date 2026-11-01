import { AbortTaskRunError, task } from "@trigger.dev/sdk";

import { TASK_CONFIGS } from "@/server/utils/task-config";

import { PROCESS_STRIPE_EVENT_TASK_ID } from "../billing.constants";
import { NonRetryableBillingError } from "../billing.errors";
import { markEventDeadLetter, processStripeEvent } from "../billing.events";

export type ProcessStripeEventPayload = {
  billingEventId: string;
};

export const processStripeEventTask = task({
  id: PROCESS_STRIPE_EVENT_TASK_ID,
  ...TASK_CONFIGS.processStripeEvent,
  onFailure: async ({ payload, error }) => {
    await markEventDeadLetter(payload.billingEventId, error);
  },
  run: async (payload: ProcessStripeEventPayload) => {
    try {
      return await processStripeEvent(payload.billingEventId);
    } catch (error) {
      if (error instanceof NonRetryableBillingError) {
        // Stops retries: payload, ownership and API version will not change between attempts.
        throw new AbortTaskRunError(`${error.code}: ${error.message}`);
      }

      throw error;
    }
  },
});
