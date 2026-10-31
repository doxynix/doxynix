import type { DbClient } from "@/server/core/db";

import { stripeIdempotencyKey } from "./idempotency";
import { getStripeClient, stripeEnvironment } from "./stripe-client";

export type SeatSyncResult = {
  quantity: number;
  synced: boolean;
};

// Network calls belong outside the membership transaction: a failed Stripe update must never roll
// back a committed membership, and a slow one must never hold the workspace lock.
export async function syncWorkspaceSeats(input: {
  db: DbClient;
  requestId: string;
  workspaceId: string;
}): Promise<SeatSyncResult> {
  const members = await input.db.workspaceMember.count({
    where: { workspaceId: input.workspaceId },
  });
  const quantity = Math.max(1, members);

  const subscription = await input.db.billingSubscription.findFirst({
    select: {
      quantity: true,
      stripeStatus: true,
      stripeSubscriptionId: true,
      stripeSubscriptionItemId: true,
    },
    where: { isCurrent: true, workspaceId: input.workspaceId },
  });

  // HOBBY workspaces have no subscription row; nothing to bill.
  if (subscription == null) {
    return { quantity, synced: false };
  }

  if (quantity === subscription.quantity) {
    return { quantity, synced: false };
  }

  // Dunning owns the item while the subscription is not active; changing seats there breaks
  // retries and grace periods.
  if (subscription.stripeStatus !== "active") {
    return { quantity, synced: false };
  }

  await getStripeClient().subscriptions.update(
    subscription.stripeSubscriptionId,
    {
      items: [{ id: subscription.stripeSubscriptionItemId, quantity }],
      proration_behavior: quantity > subscription.quantity ? "always_invoice" : "create_prorations",
    },
    {
      idempotencyKey: stripeIdempotencyKey({
        environment: stripeEnvironment(),
        operation: "seats",
        requestId: input.requestId,
        workspaceId: input.workspaceId,
      }),
    },
  );

  return { quantity, synced: true };
}
