import type Stripe from "stripe";

import { captureBillingAlert } from "@/server/core/billing/metrics";
import type { DbClient } from "@/server/core/db";

import { resolveBillingIssue, upsertBillingIssue } from "./billing.issues";
import { appendLedgerEntry } from "./billing.ledger";
import type { BillingOwnership, CanonicalStripeObject } from "./billing.resolver";
import { getStripeClient } from "./billing.stripe";

export type RiskLinks = {
  invoiceId: null | string;
  paymentIntentId: null | string;
  subscriptionId: null | string;
};

function idOf(value: null | string | { id: string } | undefined): null | string {
  if (value == null) {
    return null;
  }

  return typeof value === "string" ? value : value.id;
}

function paymentIntentOf(canonical: CanonicalStripeObject): null | string {
  switch (canonical.kind) {
    case "charge": {
      return idOf(canonical.charge.payment_intent);
    }
    case "refund": {
      return idOf(canonical.refund.payment_intent);
    }
    case "dispute": {
      return idOf(canonical.dispute.payment_intent);
    }
    case "early_fraud_warning":
    case "checkout_session":
    case "invoice":
    case "invoice_payment":
    case "subscription": {
      return null;
    }
  }
}

function chargeIdOf(canonical: CanonicalStripeObject): null | string {
  switch (canonical.kind) {
    case "charge": {
      return canonical.charge.id;
    }
    case "refund": {
      return idOf(canonical.refund.charge);
    }
    case "dispute": {
      return idOf(canonical.dispute.charge);
    }
    case "early_fraud_warning": {
      return idOf(canonical.warning.charge);
    }
    case "checkout_session":
    case "invoice":
    case "invoice_payment":
    case "subscription": {
      return null;
    }
  }
}

// Endive object graph: PaymentIntent → paid InvoicePayments → Invoice whose parent is a
// subscription. Metadata is never consulted.
export async function resolveRiskLinks(canonical: CanonicalStripeObject): Promise<RiskLinks> {
  const stripe = getStripeClient();
  let paymentIntentId = paymentIntentOf(canonical);

  if (paymentIntentId == null) {
    const chargeId = chargeIdOf(canonical);

    if (chargeId != null) {
      const charge = await stripe.charges.retrieve(chargeId);
      paymentIntentId = idOf(charge.payment_intent);
    }
  }

  if (paymentIntentId == null) {
    return { invoiceId: null, paymentIntentId: null, subscriptionId: null };
  }

  for await (const invoicePayment of stripe.invoicePayments.list({
    payment: { payment_intent: paymentIntentId, type: "payment_intent" },
    status: "paid",
  })) {
    const invoice =
      typeof invoicePayment.invoice === "string"
        ? await stripe.invoices.retrieve(invoicePayment.invoice)
        : invoicePayment.invoice;

    if ("deleted" in invoice) {
      continue;
    }

    const parent = invoice.parent;

    if (parent?.type !== "subscription_details") {
      continue;
    }

    const subscriptionId = idOf(parent.subscription_details?.subscription);

    if (subscriptionId != null) {
      return { invoiceId: invoice.id, paymentIntentId, subscriptionId };
    }
  }

  return { invoiceId: null, paymentIntentId, subscriptionId: null };
}

async function appendRefundEntry(
  tx: DbClient,
  input: {
    billingEventId: string;
    links: RiskLinks;
    ownership: BillingOwnership;
    refund: Stripe.Refund;
  },
): Promise<void> {
  const { refund } = input;
  const succeeded = refund.status === "succeeded";

  await appendLedgerEntry(tx, {
    // A refund moves money out; a failed/canceled attempt is operational, not a cash movement.
    amount: succeeded ? -BigInt(refund.amount) : BigInt(0),
    billingEventId: input.billingEventId,
    currency: refund.currency,
    details: { status: refund.status },
    kind: succeeded ? "REFUND_SUCCEEDED" : "REFUND_FAILED",
    occurredAt: new Date(refund.created * 1000),
    relatedInvoiceId: input.links.invoiceId,
    relatedSubscriptionId: input.links.subscriptionId,
    status: refund.status ?? "unknown",
    stripeObjectId: refund.id,
    workspaceId: input.ownership.workspaceId,
  });
}

async function applyDispute(
  tx: DbClient,
  input: {
    billingEventId: string;
    dispute: Stripe.Dispute;
    links: RiskLinks;
    ownership: BillingOwnership;
  },
): Promise<void> {
  const { dispute } = input;
  const status = dispute.status;
  // Stripe closes a dispute (or an inquiry) with more than `won`/`lost`: `charge_refunded` means
  // the merchant already refunded the charge, `prevented`/`warning_closed` mean it never became
  // one. All of them are terminal and none of them moves money in the ledger.
  const closedStatuses = new Set(["charge_refunded", "lost", "prevented", "warning_closed", "won"]);
  const closed = closedStatuses.has(status);
  const alreadyOpened =
    (await tx.billingLedgerEntry.findFirst({
      select: { id: true },
      where: { kind: "DISPUTE_OPENED", stripeObjectId: dispute.id },
    })) != null;

  // Cash view: opening holds the amount once, `won` returns it (and only if it was held), every
  // other closing status keeps it. A refund, if any, is a separate ledger entry.
  const entry =
    status === "won"
      ? {
          amount: alreadyOpened ? BigInt(dispute.amount) : BigInt(0),
          keyStatus: "won",
          kind: "DISPUTE_WON",
        }
      : closed
        ? { amount: BigInt(0), keyStatus: status, kind: `DISPUTE_${status.toUpperCase()}` }
        : { amount: -BigInt(dispute.amount), keyStatus: "open", kind: "DISPUTE_OPENED" };

  if (closed || !alreadyOpened) {
    await appendLedgerEntry(tx, {
      amount: entry.amount,
      billingEventId: input.billingEventId,
      currency: dispute.currency,
      details: { status },
      kind: entry.kind,
      occurredAt: new Date(dispute.created * 1000),
      relatedInvoiceId: input.links.invoiceId,
      relatedSubscriptionId: input.links.subscriptionId,
      status: entry.keyStatus,
      stripeObjectId: dispute.id,
      workspaceId: input.ownership.workspaceId,
    });
  }

  if (closed) {
    await resolveBillingIssue(tx, `dispute_opened:${dispute.id}`);

    return;
  }

  captureBillingAlert("DISPUTE", { disputeId: dispute.id });

  await upsertBillingIssue(tx, {
    dedupeKey: `dispute_opened:${dispute.id}`,
    details: { amount: dispute.amount, status },
    kind: "DISPUTE_OPENED",
    severity: "CRITICAL",
    source: "stripe_risk",
    stripeObjectId: dispute.id,
    workspaceId: input.ownership.workspaceId,
  });
}

// Risk handlers only write ledger and issues. They never touch the subscription mirror or the
// entitlement, so a refund or dispute cannot silently revoke access.
export async function applyRiskEvent(
  tx: DbClient,
  input: {
    billingEventId: string;
    canonical: CanonicalStripeObject;
    links: RiskLinks;
    ownership: BillingOwnership;
  },
): Promise<void> {
  switch (input.canonical.kind) {
    case "refund": {
      await appendRefundEntry(tx, {
        billingEventId: input.billingEventId,
        links: input.links,
        ownership: input.ownership,
        refund: input.canonical.refund,
      });
      return;
    }
    case "charge": {
      const refunds = input.canonical.charge.refunds?.data ?? [];

      for (const refund of refunds) {
        await appendRefundEntry(tx, {
          billingEventId: input.billingEventId,
          links: input.links,
          ownership: input.ownership,
          refund,
        });
      }

      return;
    }
    case "dispute": {
      await applyDispute(tx, {
        billingEventId: input.billingEventId,
        dispute: input.canonical.dispute,
        links: input.links,
        ownership: input.ownership,
      });
      return;
    }
    case "early_fraud_warning": {
      captureBillingAlert("EARLY_FRAUD_WARNING", { warningId: input.canonical.warning.id });

      await upsertBillingIssue(tx, {
        dedupeKey: `early_fraud_warning:${input.canonical.warning.id}`,
        details: { created: input.canonical.warning.created },
        kind: "EARLY_FRAUD_WARNING",
        severity: "CRITICAL",
        source: "stripe_risk",
        stripeObjectId: input.canonical.warning.id,
        workspaceId: input.ownership.workspaceId,
      });
      break;
    }
    case "checkout_session":
    case "invoice":
    case "invoice_payment":
    case "subscription": {
      break;
    }
  }
}

export function isRiskObject(canonical: CanonicalStripeObject): boolean {
  return (
    canonical.kind === "charge" ||
    canonical.kind === "refund" ||
    canonical.kind === "dispute" ||
    canonical.kind === "early_fraud_warning"
  );
}
