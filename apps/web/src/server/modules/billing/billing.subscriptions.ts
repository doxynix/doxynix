import type Stripe from "stripe";

import { recordBillingMetric } from "@/server/core/billing/metrics";
import type { DbClient } from "@/server/core/db";

import { BillingCatalogError, resolvePlanForPrice } from "./billing.catalog";
import { NonRetryableBillingError } from "./billing.errors";
import { upsertBillingIssue } from "./billing.issues";
import type { BillingOwnership } from "./billing.resolver";
import {
  type AccessState,
  DEFAULT_ACCESS_STATE,
  decideAccessState,
  isAccessState,
  isTerminalStatus,
} from "./billing.state";

function paidInvoiceAt(subscription: Stripe.Subscription): Date | null {
  const invoice = subscription.latest_invoice;

  if (invoice == null || typeof invoice !== "object" || invoice.status !== "paid") {
    return null;
  }

  const paidAt = invoice.status_transitions.paid_at;

  return paidAt == null ? null : new Date(paidAt * 1000);
}

export type ProjectedSubscription = {
  accessState: AccessState;
  mirrorId: string;
  reviewReason: null | string;
};

function currentAccessState(value: null | string | undefined): AccessState {
  if (value == null) {
    return DEFAULT_ACCESS_STATE;
  }

  return isAccessState(value) ? value : "REVIEW";
}

function isPriceKnown(price: Stripe.Price): boolean {
  try {
    resolvePlanForPrice({
      currency: price.currency,
      id: price.id,
      interval: price.recurring?.interval ?? null,
    });

    return true;
  } catch (error) {
    if (error instanceof BillingCatalogError) {
      return false;
    }

    throw error;
  }
}

// Projects the canonical Subscription into the mirror and the entitlement in one transaction. The
// entitlement state is derived from the transition table, never from the snapshot in the event.
export async function projectSubscription(
  tx: DbClient,
  input: { now: Date; ownership: BillingOwnership; subscription: Stripe.Subscription },
): Promise<ProjectedSubscription> {
  const { ownership, subscription } = input;
  const item = subscription.items.data[0];

  if (item == null) {
    throw new NonRetryableBillingError(
      "SUBSCRIPTION_ITEM_MISSING",
      `Subscription ${subscription.id} has no items`,
    );
  }

  if (ownership.billingCustomerId == null) {
    throw new NonRetryableBillingError(
      "CUSTOMER_MAPPING_MISSING",
      `No billing customer mapping for subscription ${subscription.id}`,
    );
  }

  const existing = await tx.billingSubscription.findUnique({
    select: { activatedAt: true, graceEndsAt: true, stripeStatus: true },
    where: { stripeSubscriptionId: subscription.id },
  });

  const entitlement = await tx.workspaceEntitlement.findUnique({
    select: { accessState: true, activatedAt: true, sourceSubscriptionId: true },
    where: { workspaceId: ownership.workspaceId },
  });

  // Lost `invoice.paid` must not leave a paying customer in PENDING for a month: a paid latest
  // invoice on an active subscription is proof enough, and activation stays idempotent.
  const paidAt = paidInvoiceAt(subscription);
  let activatedAt = existing?.activatedAt ?? null;

  if (
    activatedAt == null &&
    paidAt != null &&
    (subscription.status === "active" || subscription.status === "trialing")
  ) {
    const activated = await markSubscriptionActivated(tx, {
      activatedAt: paidAt,
      stripeSubscriptionId: subscription.id,
    });

    if (activated) {
      activatedAt = paidAt;
    }
  }

  // A personal HOBBY workspace is ACTIVE without a subscription; for transitions that counts as
  // NO_SUBSCRIPTION, otherwise the first paid event would look like an illegal ACTIVE -> PENDING.
  const current =
    entitlement?.sourceSubscriptionId == null
      ? DEFAULT_ACCESS_STATE
      : currentAccessState(entitlement.accessState);

  const decision = decideAccessState({
    current,
    now: input.now,
    remote: {
      activatedAt,
      graceEndsAt: existing?.graceEndsAt ?? null,
      previousStatus: existing?.stripeStatus ?? null,
      priceKnown: isPriceKnown(item.price),
      status: subscription.status,
    },
  });

  recordBillingMetric("billing_subscription_transition_total", 1, {
    from: current,
    to: decision.accessState,
  });
  recordBillingMetric("billing_entitlement_total", 1, { state: decision.accessState });

  const terminal = isTerminalStatus(subscription.status);
  const isCurrent = terminal ? null : true;
  const planCode = terminal ? "HOBBY" : "PRO";
  const requestedSeats = item.quantity ?? 1;
  const activeMembers = await tx.workspaceMember.count({
    where: { workspaceId: ownership.workspaceId },
  });

  // Stripe can report fewer seats than the workspace already has (race, manual change in the
  // Dashboard). Never shrink capacity below the people present; surface it as an issue instead.
  if (!terminal && requestedSeats < activeMembers) {
    await upsertBillingIssue(tx, {
      dedupeKey: `seats_below_members:${subscription.id}`,
      details: { activeMembers, requestedSeats },
      kind: "SEATS_BELOW_MEMBERS",
      severity: "WARNING",
      source: "stripe_worker",
      stripeObjectId: subscription.id,
      workspaceId: ownership.workspaceId,
    });
  }

  const seatLimit = terminal ? 0 : Math.max(requestedSeats, activeMembers);
  const cancelAt = subscription.cancel_at == null ? null : new Date(subscription.cancel_at * 1000);
  const currentPeriodEnd = new Date(item.current_period_end * 1000);
  const currentPeriodStart = new Date(item.current_period_start * 1000);
  const latestInvoiceId =
    subscription.latest_invoice == null
      ? null
      : typeof subscription.latest_invoice === "string"
        ? subscription.latest_invoice
        : subscription.latest_invoice.id;
  const needsReview = decision.accessState === "REVIEW";

  // Frees the single current slot before the upsert; history stays null, never false.
  if (isCurrent != null) {
    await tx.billingSubscription.updateMany({
      data: { isCurrent: null },
      where: {
        isCurrent: true,
        stripeSubscriptionId: { not: subscription.id },
        workspaceId: ownership.workspaceId,
      },
    });
  }

  const mirror = await tx.billingSubscription.upsert({
    create: {
      activatedAt: null,
      billingCustomerId: ownership.billingCustomerId,
      cancelAt,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currency: item.price.currency,
      currentPeriodEnd,
      currentPeriodStart,
      isCurrent,
      latestInvoiceId,
      needsReview,
      quantity: item.quantity ?? 1,
      reviewReason: decision.reviewReason,
      stripePriceId: item.price.id,
      stripeStatus: subscription.status,
      stripeSubscriptionId: subscription.id,
      stripeSubscriptionItemId: item.id,
      workspaceId: ownership.workspaceId,
    },
    update: {
      cancelAt,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currency: item.price.currency,
      currentPeriodEnd,
      currentPeriodStart,
      isCurrent,
      latestInvoiceId,
      needsReview,
      quantity: item.quantity ?? 1,
      reviewReason: decision.reviewReason,
      stripePriceId: item.price.id,
      stripeStatus: subscription.status,
      stripeSubscriptionItemId: item.id,
    },
    where: { stripeSubscriptionId: subscription.id },
  });

  const accessStateChanged = current !== decision.accessState;

  await tx.workspaceEntitlement.upsert({
    create: {
      accessState: decision.accessState,
      activatedAt:
        decision.accessState === "ACTIVE" ? (entitlement?.activatedAt ?? activatedAt) : null,
      planCode,
      revision: BigInt(1),
      seatLimit,
      sourceSubscriptionId: mirror.id,
      workspaceId: ownership.workspaceId,
    },
    update: {
      accessState: decision.accessState,
      activatedAt:
        decision.accessState === "ACTIVE" && entitlement?.activatedAt == null
          ? activatedAt
          : undefined,
      planCode,
      revision: accessStateChanged ? { increment: 1 } : undefined,
      seatLimit,
      sourceSubscriptionId: mirror.id,
    },
    where: { workspaceId: ownership.workspaceId },
  });

  return {
    accessState: decision.accessState,
    mirrorId: mirror.id,
    reviewReason: decision.reviewReason,
  };
}

// Activation is recorded once. A later renewal or a duplicate `invoice.paid` must not move the
// timestamp that proves when access was first granted.
export async function markSubscriptionActivated(
  db: DbClient,
  input: { activatedAt: Date; stripeSubscriptionId: string },
): Promise<boolean> {
  const updated = await db.billingSubscription.updateMany({
    data: { activatedAt: input.activatedAt },
    where: { activatedAt: null, stripeSubscriptionId: input.stripeSubscriptionId },
  });

  return updated.count > 0;
}
