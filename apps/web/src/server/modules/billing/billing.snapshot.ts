import type Stripe from "stripe";

import { BillingCatalogError, resolvePlanForPrice } from "./billing.catalog";
import { NonRetryableBillingError } from "./billing.errors";

// Everything the projection needs to know about a subscription, in provider-neutral terms. The
// Stripe adapter below is the only place where a provider object reaches billing state; a second
// provider adds its own `from…` function and the projection stays untouched.
export type SubscriptionSnapshot = {
  cancelAt: Date | null;
  cancelAtPeriodEnd: boolean;
  currency: string;
  currentPeriodEnd: Date;
  currentPeriodStart: Date;
  customerId: null | string;
  externalSubscriptionId: string;
  externalSubscriptionItemId: string;
  // The catalog maps one price to one plan; a second item must not be ignored silently.
  itemCount: number;
  latestInvoiceId: null | string;
  latestInvoiceStatus: null | string;
  // Proof that the first period was paid, from a paid latest invoice.
  paidAt: Date | null;
  priceId: string;
  priceKnown: boolean;
  quantity: number;
  status: string;
};

function priceKnown(price: Stripe.Price): boolean {
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

function paidInvoiceAt(invoice: null | string | Stripe.Invoice): Date | null {
  if (invoice == null || typeof invoice === "string" || invoice.status !== "paid") {
    return null;
  }

  const paidAt = invoice.status_transitions.paid_at;

  return paidAt == null ? null : new Date(paidAt * 1000);
}

function invoiceId(invoice: null | string | Stripe.Invoice): null | string {
  if (invoice == null) {
    return null;
  }

  return typeof invoice === "string" ? invoice : invoice.id;
}

export function fromStripeSubscription(subscription: Stripe.Subscription): SubscriptionSnapshot {
  const item = subscription.items.data[0];

  if (item == null) {
    throw new NonRetryableBillingError(
      "SUBSCRIPTION_ITEM_MISSING",
      `Subscription ${subscription.id} has no items`,
    );
  }

  const latestInvoice = subscription.latest_invoice;

  return {
    cancelAt: subscription.cancel_at == null ? null : new Date(subscription.cancel_at * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    currency: item.price.currency,
    currentPeriodEnd: new Date(item.current_period_end * 1000),
    currentPeriodStart: new Date(item.current_period_start * 1000),
    customerId:
      typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
    externalSubscriptionId: subscription.id,
    externalSubscriptionItemId: item.id,
    itemCount: subscription.items.data.length,
    latestInvoiceId: invoiceId(latestInvoice),
    // Only an expanded invoice carries a status; a bare id must not wipe what we already stored.
    latestInvoiceStatus:
      latestInvoice != null && typeof latestInvoice === "object" ? latestInvoice.status : null,
    paidAt: paidInvoiceAt(latestInvoice),
    priceId: item.price.id,
    priceKnown: priceKnown(item.price),
    quantity: item.quantity ?? 1,
    status: subscription.status,
  };
}
