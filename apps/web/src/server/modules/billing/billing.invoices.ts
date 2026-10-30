import type Stripe from "stripe";

import type { DbClient } from "@/server/core/db";

import { appendLedgerEntry } from "./billing.ledger";
import type { BillingOwnership } from "./billing.resolver";
import { getStripeClient } from "./billing.stripe";
import { markSubscriptionActivated, projectSubscription } from "./billing.subscriptions";

export const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

export type InvoiceEventInput = {
  billingEventId: string;
  eventCreatedAt: Date;
  eventType: string;
  invoice: Stripe.Invoice;
  now: Date;
  ownership: BillingOwnership;
  // Retrieved by the caller before the transaction: a network call must not hold a DB transaction.
  subscription: null | Stripe.Subscription;
};

// Endive moved the link under `parent.subscription_details`; the flat field is legacy.
export function subscriptionIdOf(invoice: Stripe.Invoice): null | string {
  const subscription = invoice.parent?.subscription_details?.subscription;

  if (subscription == null) {
    return null;
  }

  return typeof subscription === "string" ? subscription : subscription.id;
}

function paidAtOf(invoice: Stripe.Invoice, fallback: Date): Date {
  const paidAt = invoice.status_transitions.paid_at;

  return paidAt == null ? fallback : new Date(paidAt * 1000);
}

async function applyInvoicePaid(tx: DbClient, input: InvoiceEventInput): Promise<void> {
  const subscriptionId = subscriptionIdOf(input.invoice);
  const paidAt = paidAtOf(input.invoice, input.now);

  await appendLedgerEntry(tx, {
    amount: BigInt(input.invoice.amount_paid),
    billingEventId: input.billingEventId,
    currency: input.invoice.currency,
    details: { type: input.eventType },
    kind: "INVOICE_PAID",
    occurredAt: paidAt,
    relatedInvoiceId: input.invoice.id,
    relatedSubscriptionId: subscriptionId,
    status: "paid",
    stripeObjectId: input.invoice.id,
    workspaceId: input.ownership.workspaceId,
  });

  if (subscriptionId == null) {
    return;
  }

  // First paid invoice wins; a renewal must not move the timestamp that proves access began.
  await markSubscriptionActivated(tx, {
    activatedAt: paidAt,
    stripeSubscriptionId: subscriptionId,
  });

  // Recovery: a paid invoice plus a canonical active subscription clears the dunning window.
  await tx.billingSubscription.updateMany({
    data: { graceEndsAt: null, pastDueStartedAt: null },
    where: { stripeSubscriptionId: subscriptionId, workspaceId: input.ownership.workspaceId },
  });

  if (input.subscription == null) {
    return;
  }

  await projectSubscription(tx, {
    now: input.now,
    ownership: input.ownership,
    subscription: input.subscription,
  });
}

async function applyInvoicePaymentFailed(tx: DbClient, input: InvoiceEventInput): Promise<void> {
  const subscriptionId = subscriptionIdOf(input.invoice);

  if (subscriptionId == null) {
    return;
  }

  const mirror = await tx.billingSubscription.findUnique({
    select: { pastDueStartedAt: true },
    where: { stripeSubscriptionId: subscriptionId },
  });

  // Only the first failure opens the grace window; later retries must not extend it.
  if (mirror?.pastDueStartedAt == null) {
    await tx.billingSubscription.updateMany({
      data: {
        graceEndsAt: new Date(input.eventCreatedAt.getTime() + GRACE_PERIOD_MS),
        pastDueStartedAt: input.eventCreatedAt,
      },
      where: { stripeSubscriptionId: subscriptionId },
    });
  }

  if (input.subscription == null) {
    return;
  }

  await projectSubscription(tx, {
    now: input.now,
    ownership: input.ownership,
    subscription: input.subscription,
  });
}

// Runs outside the transaction. Returns null for one-off invoices that have no subscription.
export async function retrieveSubscriptionForInvoice(
  invoice: Stripe.Invoice,
): Promise<null | Stripe.Subscription> {
  const subscriptionId = subscriptionIdOf(invoice);

  if (subscriptionId == null) {
    return null;
  }

  return getStripeClient().subscriptions.retrieve(subscriptionId);
}

export async function applyInvoiceEvent(tx: DbClient, input: InvoiceEventInput): Promise<void> {
  if (input.eventType === "invoice.paid") {
    await applyInvoicePaid(tx, input);
    return;
  }

  if (input.eventType === "invoice.payment_failed") {
    await applyInvoicePaymentFailed(tx, input);
  }
}
