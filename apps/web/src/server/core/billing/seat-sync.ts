import { prisma } from "@/server/core/db";

import { stripeIdempotencyKey } from "./idempotency";
import { getStripeClient, stripeEnvironment } from "./stripe-client";

export type SeatSyncResult = {
  quantity: number;
  synced: boolean;
};

// Seats are billing state, not tenant data: this runs on the system client so the post-commit
// path also works when the actor just left the workspace (self-removal, account deletion).
export async function syncWorkspaceSeats(input: {
  requestId: string;
  workspaceId: string;
}): Promise<SeatSyncResult> {
  const members = await prisma.workspaceMember.count({
    where: { workspaceId: input.workspaceId },
  });
  const quantity = Math.max(1, members);

  const subscription = await prisma.billingSubscription.findFirst({
    select: {
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

  // Dunning owns the item while the subscription is not active; changing seats there breaks
  // retries and grace periods. Reconciliation still compares quantity with members and repairs it.
  if (subscription.stripeStatus !== "active") {
    return { quantity, synced: false };
  }

  // Always send the absolute target. The local mirror only learns the new quantity from a webhook,
  // so "equal to the mirror" is not "equal to Stripe" — comparing against it silently skips the
  // update and leaves the customer paying for a seat that no longer exists.
  const remote = await getStripeClient().subscriptions.retrieve(subscription.stripeSubscriptionId);
  const currentQuantity = remote.items.data[0]?.quantity ?? 1;

  if (currentQuantity === quantity) {
    return { quantity, synced: false };
  }

  await getStripeClient().subscriptions.update(
    subscription.stripeSubscriptionId,
    {
      items: [{ id: subscription.stripeSubscriptionItemId, quantity }],
      proration_behavior: quantity > currentQuantity ? "always_invoice" : "create_prorations",
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
