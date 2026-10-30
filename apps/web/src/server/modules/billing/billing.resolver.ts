import type Stripe from "stripe";

import type { DbClient } from "@/server/core/db";

import { STRIPE_PROVIDER } from "./billing.constants";
import { NonRetryableBillingError } from "./billing.errors";
import { getStripeClient } from "./billing.stripe";

export type StoredStripeEvent = {
  api_version?: null | string;
  created?: number;
  data: { object: { id: string; object: string } };
  id: string;
  type: string;
};

export type CanonicalStripeObject =
  | { kind: "charge"; charge: Stripe.Charge }
  | { kind: "checkout_session"; session: Stripe.Checkout.Session }
  | { kind: "dispute"; dispute: Stripe.Dispute }
  | { kind: "early_fraud_warning"; warning: Stripe.Radar.EarlyFraudWarning }
  | { kind: "invoice"; invoice: Stripe.Invoice }
  | { kind: "invoice_payment"; invoicePayment: Stripe.InvoicePayment }
  | { kind: "refund"; refund: Stripe.Refund }
  | { kind: "subscription"; subscription: Stripe.Subscription };

export type BillingOwnership = {
  billingCustomerId: null | string;
  customerId: null | string;
  workspaceId: string;
};

function idOf(value: null | string | { id: string } | undefined): null | string {
  if (value == null) {
    return null;
  }

  return typeof value === "string" ? value : value.id;
}

// The snapshot in the event may be older than the object it describes; the worker always projects
// the current object, so delivery order stops mattering.
export async function resolveCanonicalObject(
  event: StoredStripeEvent,
): Promise<CanonicalStripeObject> {
  const stripe = getStripeClient();
  const objectId = event.data.object.id;

  if (event.type.startsWith("customer.subscription.")) {
    return {
      kind: "subscription",
      // Expanded so the projection can see whether the latest invoice is already paid.
      subscription: await stripe.subscriptions.retrieve(objectId, {
        expand: ["latest_invoice"],
      }),
    };
  }

  if (event.type.startsWith("invoice.")) {
    return { invoice: await stripe.invoices.retrieve(objectId), kind: "invoice" };
  }

  if (event.type === "invoice_payment.paid") {
    return {
      invoicePayment: await stripe.invoicePayments.retrieve(objectId, { expand: ["invoice"] }),
      kind: "invoice_payment",
    };
  }

  if (event.type.startsWith("checkout.session.")) {
    return { kind: "checkout_session", session: await stripe.checkout.sessions.retrieve(objectId) };
  }

  if (event.type.startsWith("charge.dispute.")) {
    return { dispute: await stripe.disputes.retrieve(objectId), kind: "dispute" };
  }

  if (event.type === "charge.refunded") {
    return {
      charge: await stripe.charges.retrieve(objectId, { expand: ["refunds"] }),
      kind: "charge",
    };
  }

  if (event.type.startsWith("refund.")) {
    return { kind: "refund", refund: await stripe.refunds.retrieve(objectId) };
  }

  if (event.type === "radar.early_fraud_warning.created") {
    return {
      kind: "early_fraud_warning",
      warning: await stripe.radar.earlyFraudWarnings.retrieve(objectId),
    };
  }

  throw new NonRetryableBillingError(
    "UNSUPPORTED_EVENT_TYPE",
    `Unsupported event type: ${event.type}`,
  );
}

// Refunds, disputes and fraud warnings only carry a charge id, so the customer comes from the
// charge object. This is the documented Endive object graph, not metadata guessing.
async function customerIdFor(canonical: CanonicalStripeObject): Promise<null | string> {
  const stripe = getStripeClient();

  switch (canonical.kind) {
    case "subscription": {
      return idOf(canonical.subscription.customer);
    }
    case "invoice": {
      return idOf(canonical.invoice.customer);
    }
    case "checkout_session": {
      return idOf(canonical.session.customer);
    }
    case "invoice_payment": {
      const invoice = canonical.invoicePayment.invoice;

      if (typeof invoice === "string" || "deleted" in invoice) {
        return null;
      }

      return idOf(invoice.customer);
    }
    case "charge": {
      return idOf(canonical.charge.customer);
    }
    case "refund": {
      const chargeId = idOf(canonical.refund.charge);

      if (chargeId == null) {
        return null;
      }

      const charge = await stripe.charges.retrieve(chargeId);

      return idOf(charge.customer);
    }
    case "dispute": {
      const chargeId = idOf(canonical.dispute.charge);

      if (chargeId == null) {
        return null;
      }

      const charge = await stripe.charges.retrieve(chargeId);

      return idOf(charge.customer);
    }
    case "early_fraud_warning": {
      const chargeId = idOf(canonical.warning.charge);

      if (chargeId == null) {
        return null;
      }

      const charge = await stripe.charges.retrieve(chargeId);

      return idOf(charge.customer);
    }
    default: {
      return null;
    }
  }
}

// Ownership comes from our own tables: customer mapping first, then the Checkout session row that
// the checkout command wrote. Never from Stripe metadata.
export async function resolveOwnership(
  db: DbClient,
  canonical: CanonicalStripeObject,
): Promise<null | BillingOwnership> {
  const customerId = await customerIdFor(canonical);

  if (customerId != null) {
    const mapping = await db.billingCustomer.findFirst({
      select: { id: true, workspaceId: true },
      where: { externalCustomerId: customerId, provider: STRIPE_PROVIDER },
    });

    if (mapping != null) {
      return { billingCustomerId: mapping.id, customerId, workspaceId: mapping.workspaceId };
    }
  }

  if (canonical.kind === "checkout_session") {
    const sessionMapping = await db.billingCheckoutSession.findFirst({
      select: { workspaceId: true },
      where: { stripeCheckoutSessionId: canonical.session.id },
    });

    if (sessionMapping != null) {
      return {
        billingCustomerId: null,
        customerId,
        workspaceId: sessionMapping.workspaceId,
      };
    }
  }

  return null;
}
