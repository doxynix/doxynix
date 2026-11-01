import type { Redis } from "@upstash/redis";

import { prisma } from "@/server/core/db";

import { billingIdempotencyKey } from "./idempotency";
import { getStripeClient, providerEnvironment } from "./stripe-client";

export type SeatSyncResult = {
  quantity: number;
  synced: boolean;
};

const LOCK_TTL_MS = 15_000;
const LOCK_RETRIES = 5;
const LOCK_RETRY_DELAY_MS = 120;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Two membership mutations can otherwise compute quantities concurrently and apply them out of
// order; the lock is best-effort because Redis being down must not stop seat billing.
async function withSeatLock<T>(workspaceId: string, fn: () => Promise<T>): Promise<T> {
  const key = `seat-sync:${workspaceId}`;
  let client: Redis;

  try {
    ({ redisClient: client } = await import("@/server/core/redis"));
  } catch {
    return fn();
  }

  for (let attempt = 0; attempt < LOCK_RETRIES; attempt += 1) {
    let acquired = false;

    try {
      acquired = (await client.set(key, "1", { nx: true, px: LOCK_TTL_MS })) != null;
    } catch {
      return fn();
    }

    if (acquired) {
      try {
        return await fn();
      } finally {
        await client.del(key).catch(() => undefined);
      }
    }

    await sleep(LOCK_RETRY_DELAY_MS);
  }

  return fn();
}

// Seats are billing state, not tenant data: this runs on the system client so the post-commit
// path also works when the actor just left the workspace (self-removal, account deletion).
export async function syncWorkspaceSeats(input: {
  requestId: string;
  workspaceId: string;
}): Promise<SeatSyncResult> {
  return withSeatLock(input.workspaceId, async () => {
    const members = await prisma.workspaceMember.count({
      where: { workspaceId: input.workspaceId },
    });
    const quantity = Math.max(1, members);

    const subscription = await prisma.billingSubscription.findFirst({
      select: {
        externalStatus: true,
        externalSubscriptionId: true,
        externalSubscriptionItemId: true,
      },
      where: { isCurrent: true, workspaceId: input.workspaceId },
    });

    // HOBBY workspaces have no subscription row; nothing to bill.
    if (subscription == null) {
      return { quantity, synced: false };
    }

    // Dunning owns the item while the subscription is not active; changing seats there breaks
    // retries and grace periods. Reconciliation still compares quantity with members and repairs it.
    if (subscription.externalStatus !== "active") {
      return { quantity, synced: false };
    }

    // Always send the absolute target. The local mirror only learns the new quantity from a webhook,
    // so "equal to the mirror" is not "equal to Stripe" — comparing against it silently skips the
    // update and leaves the customer paying for a seat that no longer exists.
    const remote = await getStripeClient().subscriptions.retrieve(
      subscription.externalSubscriptionId,
    );
    const currentQuantity = remote.items.data[0]?.quantity ?? 1;

    if (currentQuantity === quantity) {
      return { quantity, synced: false };
    }

    await getStripeClient().subscriptions.update(
      subscription.externalSubscriptionId,
      {
        items: [{ id: subscription.externalSubscriptionItemId, quantity }],
        proration_behavior: quantity > currentQuantity ? "always_invoice" : "create_prorations",
      },
      {
        idempotencyKey: billingIdempotencyKey({
          environment: providerEnvironment(),
          operation: "seats",
          requestId: input.requestId,
          workspaceId: input.workspaceId,
        }),
      },
    );

    return { quantity, synced: true };
  });
}
