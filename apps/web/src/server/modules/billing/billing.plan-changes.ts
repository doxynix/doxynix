import { TRPCError } from "@trpc/server";

import type { DbClient } from "@/server/core/db";
import { getWorkspaceEntitlement } from "@/server/core/entitlements";

import { resolvePlanForPrice } from "./billing.catalog";
import { runBillingOperation, stripeIdempotencyKey } from "./billing.operations";
import { getStripeClient, stripeEnvironment } from "./billing.stripe";

export type ProrationBehavior = "always_invoice" | "create_prorations";

type PlanChangeBase = {
  actorUserId: string;
  db: DbClient;
  quantity: number;
  workspaceId: string;
};

export type PreviewPlanChangeInput = PlanChangeBase;

export type PlanChangeInput = PlanChangeBase & {
  requestId: string;
};

export type PlanChangePreview = {
  amountDueCents: number;
  currency: string;
  prorationBehavior: ProrationBehavior;
  quantity: number;
};

export type SeatChangeResult =
  | { changed: false; quantity: number }
  | {
      changed: true;
      operationId: string;
      prorationBehavior: ProrationBehavior;
      quantity: number;
      replayed: boolean;
    };

type CurrentSubscription = {
  currency: string;
  quantity: number;
  stripePriceId: string;
  stripeStatus: string;
  stripeSubscriptionId: string;
  stripeSubscriptionItemId: string;
};

// Seat changes for one workspace are serialized: two parallel commands must not interleave their
// read-modify-write against Stripe. The lock is non-blocking on purpose — a second click gets a
// retryable 409 instead of holding an HTTP request open for the duration of a Stripe call.
async function withWorkspaceLock<T>(
  db: DbClient,
  workspaceId: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (!("$transaction" in db)) {
    return fn();
  }

  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ locked: boolean }>>`
      SELECT pg_try_advisory_xact_lock(hashtext(${workspaceId})) AS locked
    `;

    if (rows[0]?.locked !== true) {
      throw new TRPCError({ code: "CONFLICT", message: "CONCURRENT_SEAT_CHANGE" });
    }

    return fn();
  });
}

function notChangeable(): TRPCError {
  return new TRPCError({ code: "CONFLICT", message: "BILLING_NOT_CHANGEABLE" });
}

// Section 9: only an active, catalogued, single-item subscription can be changed. Delinquent or
// reviewed workspaces must resolve that state first.
async function loadChangeableSubscription(
  db: DbClient,
  workspaceId: string,
): Promise<CurrentSubscription> {
  const entitlement = await getWorkspaceEntitlement(db, workspaceId);

  if (entitlement?.accessState !== "ACTIVE") {
    throw notChangeable();
  }

  const subscription = await db.billingSubscription.findFirst({
    select: {
      currency: true,
      quantity: true,
      stripePriceId: true,
      stripeStatus: true,
      stripeSubscriptionId: true,
      stripeSubscriptionItemId: true,
    },
    where: { isCurrent: true, workspaceId },
  });

  if (subscription?.stripeStatus !== "active") {
    throw notChangeable();
  }

  try {
    resolvePlanForPrice({
      currency: subscription.currency,
      id: subscription.stripePriceId,
      interval: "month",
    });
  } catch {
    throw notChangeable();
  }

  return subscription;
}

function prorationFor(quantity: number, currentQuantity: number): ProrationBehavior {
  return quantity >= currentQuantity ? "always_invoice" : "create_prorations";
}

async function assertSeatFloor(db: DbClient, workspaceId: string, quantity: number): Promise<void> {
  const members = await db.workspaceMember.count({ where: { workspaceId } });

  if (quantity < members) {
    throw new TRPCError({ code: "CONFLICT", message: "SEATS_BELOW_MEMBERS" });
  }
}

export async function previewPlanChange(input: PreviewPlanChangeInput): Promise<PlanChangePreview> {
  const subscription = await loadChangeableSubscription(input.db, input.workspaceId);
  const prorationBehavior = prorationFor(input.quantity, subscription.quantity);

  // Read-only: the preview must never mutate the subscription.
  const preview = await getStripeClient().invoices.createPreview({
    subscription: subscription.stripeSubscriptionId,
    subscription_details: {
      items: [{ id: subscription.stripeSubscriptionItemId, quantity: input.quantity }],
      proration_behavior: prorationBehavior,
    },
  });

  return {
    amountDueCents: preview.amount_due,
    currency: preview.currency,
    prorationBehavior,
    quantity: input.quantity,
  };
}

export async function changeSeats(input: PlanChangeInput): Promise<SeatChangeResult> {
  const current = await loadChangeableSubscription(input.db, input.workspaceId);

  // Nothing to bill: no Stripe call, no operation row.
  if (input.quantity === current.quantity) {
    return { changed: false, quantity: input.quantity };
  }

  if (input.quantity < current.quantity) {
    await assertSeatFloor(input.db, input.workspaceId, input.quantity);
  }

  const run = await runBillingOperation(input.db, {
    actorUserId: input.actorUserId,
    execute: async () => {
      return withWorkspaceLock(input.db, input.workspaceId, async () => {
        // Re-read inside the lock: the subscription may have changed since the preview.
        const subscription = await loadChangeableSubscription(input.db, input.workspaceId);
        const prorationBehavior = prorationFor(input.quantity, subscription.quantity);

        const updated = await getStripeClient().subscriptions.update(
          subscription.stripeSubscriptionId,
          {
            items: [{ id: subscription.stripeSubscriptionItemId, quantity: input.quantity }],
            proration_behavior: prorationBehavior,
          },
          {
            idempotencyKey: stripeIdempotencyKey({
              environment: stripeEnvironment(),
              operation: "subscription",
              requestId: input.requestId,
              workspaceId: input.workspaceId,
            }),
          },
        );

        // The response never grants access; only the webhook projection does.
        return {
          result: { prorationBehavior, quantity: input.quantity },
          stripeObjectId: updated.id,
        };
      });
    },
    operation: "SUBSCRIPTION_UPDATE",
    requestBody: { quantity: input.quantity, workspaceId: input.workspaceId },
    requestId: input.requestId,
    workspaceId: input.workspaceId,
  });

  // A replay returns the stored behavior; recomputing from the current quantity would flip it.
  const stored = run.result;
  const prorationBehavior =
    typeof stored === "object" &&
    stored != null &&
    "prorationBehavior" in stored &&
    (stored.prorationBehavior === "always_invoice" ||
      stored.prorationBehavior === "create_prorations")
      ? stored.prorationBehavior
      : prorationFor(input.quantity, current.quantity);

  return {
    changed: true,
    operationId: run.operationId,
    prorationBehavior,
    quantity: input.quantity,
    replayed: run.replayed,
  };
}
