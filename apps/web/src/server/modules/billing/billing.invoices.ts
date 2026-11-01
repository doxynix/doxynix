import type Stripe from "stripe";

import { upsertBillingIssue } from "@/server/core/billing/issue";
import { getStripeClient } from "@/server/core/billing/stripe-client";
import type { DbClient } from "@/server/core/db";

import { appendLedgerEntry } from "./billing.ledger";
import type { BillingOwnership } from "./billing.resolver";
import { fromStripeSubscription } from "./billing.snapshot";
import { markSubscriptionActivated, projectSubscription } from "./billing.subscriptions";
import { recordTaxCollection } from "./billing.tax";

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
    externalObjectId: input.invoice.id,
    kind: "INVOICE_PAID",
    occurredAt: paidAt,
    relatedInvoiceId: input.invoice.id,
    relatedSubscriptionId: subscriptionId,
    status: "paid",
    workspaceId: input.ownership.workspaceId,
  });

  if (subscriptionId == null) {
    return;
  }

  // First paid invoice wins; a renewal must not move the timestamp that proves access began.
  await markSubscriptionActivated(tx, {
    activatedAt: paidAt,
    externalSubscriptionId: subscriptionId,
  });

  // Recovery is decided by the canonical subscription, not by an invoice: a paid invoice for an
  // older period while the subscription is still `past_due` must keep the running grace window.
  await recordTaxCollection(tx, {
    invoice: input.invoice,
    workspaceId: input.ownership.workspaceId,
  });

  if (input.subscription == null) {
    return;
  }

  await projectSubscription(tx, {
    now: input.now,
    ownership: input.ownership,
    snapshot: fromStripeSubscription(input.subscription),
  });
}

async function applyInvoicePaymentFailed(tx: DbClient, input: InvoiceEventInput): Promise<void> {
  const subscriptionId = subscriptionIdOf(input.invoice);

  if (subscriptionId == null) {
    return;
  }

  const mirror = await tx.billingSubscription.findUnique({
    select: { pastDueStartedAt: true },
    where: { externalSubscriptionId: subscriptionId },
  });

  // Only the first failure opens the grace window; later retries must not extend it.
  if (mirror?.pastDueStartedAt == null) {
    await tx.billingSubscription.updateMany({
      data: {
        graceEndsAt: new Date(input.eventCreatedAt.getTime() + GRACE_PERIOD_MS),
        pastDueStartedAt: input.eventCreatedAt,
      },
      where: { externalSubscriptionId: subscriptionId },
    });
  }

  if (input.subscription == null) {
    return;
  }

  await projectSubscription(tx, {
    now: input.now,
    ownership: input.ownership,
    snapshot: fromStripeSubscription(input.subscription),
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

  return getStripeClient().subscriptions.retrieve(subscriptionId, {
    expand: ["latest_invoice"],
  });
}

// A tax-location failure blocks payment collection but not access: the customer keeps the current
// billing state until a canonical transition says otherwise.
async function applyInvoiceFinalizationFailed(
  tx: DbClient,
  input: InvoiceEventInput,
): Promise<void> {
  if (input.invoice.automatic_tax.status !== "requires_location_inputs") {
    return;
  }

  const subscriptionId = subscriptionIdOf(input.invoice);

  if (subscriptionId != null) {
    await tx.billingSubscription.updateMany({
      data: { needsAction: "TAX_LOCATION" },
      where: { externalSubscriptionId: subscriptionId },
    });
  }

  await upsertBillingIssue(tx, {
    dedupeKey: `tax_location:${input.invoice.id}`,
    details: { needsAction: "TAX_LOCATION" },
    externalObjectId: input.invoice.id,
    kind: "TAX_LOCATION",
    severity: "CRITICAL",
    source: "tax",
    workspaceId: input.ownership.workspaceId,
  });
}

export async function applyInvoiceEvent(tx: DbClient, input: InvoiceEventInput): Promise<void> {
  if (input.eventType === "invoice.paid") {
    await applyInvoicePaid(tx, input);
    return;
  }

  if (input.eventType === "invoice.payment_failed") {
    await applyInvoicePaymentFailed(tx, input);
    return;
  }

  if (input.eventType === "invoice.finalization_failed") {
    await applyInvoiceFinalizationFailed(tx, input);
  }
}
