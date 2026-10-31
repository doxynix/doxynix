import { Prisma } from "@prisma/client";
import type Stripe from "stripe";

import { appLogger } from "@/server/core/app-logger";
import { prisma } from "@/server/core/db";

import { STRIPE_PROVIDER } from "./billing.constants";
import { upsertBillingIssue } from "./billing.issues";
import { appendLedgerEntry } from "./billing.ledger";
import { getStripeClient } from "./billing.stripe";
import { projectSubscription } from "./billing.subscriptions";
import { runTaxPreflight } from "./billing.tax";

const DAY_MS = 24 * 60 * 60 * 1000;
const LEDGER_LOOKBACK_MS = 90 * DAY_MS;
const RECONCILIATION_ALERT_MS = 26 * 60 * 60 * 1000;
const STALE_QUEUE_MS = 15 * 60 * 1000;
const PAGE_SIZE = 100;

export type ReconciliationSummary = {
  checkedSubscriptions: number;
  mismatchCount: number;
  runId: null | string;
  skipped: boolean;
};

function dateOnly(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function isMissingResource(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "resource_missing"
  );
}

function idOf(value: null | string | { id: string } | undefined): null | string {
  if (value == null) {
    return null;
  }

  return typeof value === "string" ? value : value.id;
}

function seconds(date: Date | null): null | number {
  return date == null ? null : Math.floor(date.getTime() / 1000);
}

async function* listAllSubscriptions(stripe: Stripe): AsyncGenerator<Stripe.Subscription> {
  let startingAfter: string | undefined;

  do {
    const page = await stripe.subscriptions.list({
      expand: ["data.latest_invoice"],
      limit: PAGE_SIZE,
      starting_after: startingAfter,
      status: "all",
    });

    for (const subscription of page.data) {
      yield subscription;
    }

    startingAfter = page.has_more ? page.data.at(-1)?.id : undefined;
  } while (startingAfter != null);
}

function itemOf(subscription: Stripe.Subscription): null | Stripe.SubscriptionItem {
  return subscription.items.data[0] ?? null;
}

function differs(local: Record<string, unknown>, subscription: Stripe.Subscription): boolean {
  const item = itemOf(subscription);

  if (item == null) {
    return true;
  }

  return (
    local.stripeStatus !== subscription.status ||
    local.stripePriceId !== item.price.id ||
    local.quantity !== (item.quantity ?? 1) ||
    local.currency !== item.price.currency ||
    local.stripeSubscriptionItemId !== item.id ||
    seconds(local.currentPeriodStart as Date) !== item.current_period_start ||
    seconds(local.currentPeriodEnd as Date) !== item.current_period_end ||
    local.cancelAtPeriodEnd !== subscription.cancel_at_period_end
  );
}

async function unownedIssue(stripeObjectId: string): Promise<void> {
  await upsertBillingIssue(prisma, {
    dedupeKey: `unowned:${stripeObjectId}`,
    details: { source: "reconciliation" },
    kind: "UNOWNED_STRIPE_OBJECT",
    severity: "CRITICAL",
    source: "stripe_reconciliation",
    stripeObjectId,
  });
}

async function repair(
  subscription: Stripe.Subscription,
  ownership: { billingCustomerId: string; customerId: null | string; workspaceId: string },
  now: Date,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await projectSubscription(tx, { now, ownership, subscription });
  });
}

async function reconcileSubscription(
  subscription: Stripe.Subscription,
  now: Date,
): Promise<boolean> {
  const customerId = idOf(subscription.customer);
  const mapping =
    customerId == null
      ? null
      : await prisma.billingCustomer.findFirst({
          select: { id: true, workspaceId: true },
          where: { externalCustomerId: customerId, provider: STRIPE_PROVIDER },
        });
  const local = await prisma.billingSubscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (mapping == null) {
    // Never guess a tenant: an object without a workspace mapping is fail-closed.
    await unownedIssue(subscription.id);

    return true;
  }

  if (local == null) {
    await repair(
      subscription,
      { billingCustomerId: mapping.id, customerId, workspaceId: mapping.workspaceId },
      now,
    );

    return true;
  }

  if (local.workspaceId !== mapping.workspaceId) {
    await upsertBillingIssue(prisma, {
      dedupeKey: `owner_mismatch:${subscription.id}`,
      details: { localWorkspaceId: local.workspaceId },
      kind: "OWNER_MISMATCH",
      severity: "CRITICAL",
      source: "stripe_reconciliation",
      stripeObjectId: subscription.id,
      workspaceId: local.workspaceId,
    });

    return true;
  }

  if (!differs(local, subscription)) {
    return false;
  }

  await repair(
    subscription,
    { billingCustomerId: mapping.id, customerId, workspaceId: mapping.workspaceId },
    now,
  );

  return true;
}

async function reconcileMissingLocal(seen: Set<string>, now: Date): Promise<number> {
  const stripe = getStripeClient();
  const locals = await prisma.billingSubscription.findMany({
    select: { stripeSubscriptionId: true, workspaceId: true },
    where: { isCurrent: true },
  });
  let mismatches = 0;

  for (const local of locals) {
    if (seen.has(local.stripeSubscriptionId)) {
      continue;
    }

    try {
      // A direct retrieve separates a pagination gap from a genuinely deleted subscription.
      const subscription = await stripe.subscriptions.retrieve(local.stripeSubscriptionId, {
        expand: ["latest_invoice"],
      });
      const customerId = idOf(subscription.customer);
      const mapping =
        customerId == null
          ? null
          : await prisma.billingCustomer.findFirst({
              select: { id: true },
              where: { externalCustomerId: customerId, provider: STRIPE_PROVIDER },
            });

      if (mapping != null) {
        await repair(
          subscription,
          { billingCustomerId: mapping.id, customerId, workspaceId: local.workspaceId },
          now,
        );
      }

      mismatches += 1;
    } catch (error) {
      if (!isMissingResource(error)) {
        throw error;
      }

      await prisma.billingSubscription.updateMany({
        data: { needsReview: true, reviewReason: "MISSING_IN_STRIPE" },
        where: { stripeSubscriptionId: local.stripeSubscriptionId },
      });
      await prisma.workspaceEntitlement.updateMany({
        data: { accessState: "REVIEW" },
        where: { workspaceId: local.workspaceId },
      });
      await upsertBillingIssue(prisma, {
        dedupeKey: `missing_in_stripe:${local.stripeSubscriptionId}`,
        details: {},
        kind: "MISSING_IN_STRIPE",
        severity: "CRITICAL",
        source: "stripe_reconciliation",
        stripeObjectId: local.stripeSubscriptionId,
        workspaceId: local.workspaceId,
      });

      mismatches += 1;
    }
  }

  return mismatches;
}

async function reconcileLedger(now: Date): Promise<number> {
  const stripe = getStripeClient();
  const entries = await prisma.billingLedgerEntry.findMany({
    select: { amount: true, currency: true, id: true, stripeObjectId: true, workspaceId: true },
    where: {
      kind: "INVOICE_PAID",
      occurredAt: { gte: new Date(now.getTime() - LEDGER_LOOKBACK_MS) },
    },
  });
  let mismatches = 0;

  for (const entry of entries) {
    let invoice: Stripe.Invoice;

    try {
      invoice = await stripe.invoices.retrieve(entry.stripeObjectId);
    } catch (error) {
      if (!isMissingResource(error)) {
        throw error;
      }

      await upsertBillingIssue(prisma, {
        dedupeKey: `missing_invoice:${entry.stripeObjectId}`,
        details: {},
        kind: "MISSING_INVOICE",
        severity: "CRITICAL",
        source: "stripe_reconciliation",
        stripeObjectId: entry.stripeObjectId,
      });
      mismatches += 1;
      continue;
    }

    const expected = BigInt(invoice.amount_paid);

    if (entry.amount === expected && entry.currency === invoice.currency) {
      continue;
    }

    // Append-only: the original entry is never edited, a correction points at it.
    await appendLedgerEntry(prisma, {
      amount: expected - entry.amount,
      correctsEntryId: entry.id,
      currency: invoice.currency,
      details: { source: "reconciliation" },
      kind: "INVOICE_PAID_CORRECTION",
      occurredAt: now,
      relatedInvoiceId: invoice.id,
      status: `correction:${expected - entry.amount}`,
      stripeObjectId: entry.stripeObjectId,
      workspaceId: entry.workspaceId,
    });
    mismatches += 1;
  }

  return mismatches;
}

async function checkEventQueue(now: Date): Promise<void> {
  const oldest = await prisma.billingEvent.findFirst({
    orderBy: { receivedAt: "asc" },
    select: { id: true, receivedAt: true },
    where: {
      receivedAt: { lt: new Date(now.getTime() - STALE_QUEUE_MS) },
      status: { in: ["RECEIVED", "ENQUEUED", "PROCESSING"] },
    },
  });

  if (oldest == null) {
    return;
  }

  await upsertBillingIssue(prisma, {
    dedupeKey: `event_queue_stalled:${oldest.id}`,
    details: { receivedAt: oldest.receivedAt.toISOString() },
    kind: "EVENT_QUEUE_STALLED",
    severity: "WARNING",
    source: "stripe_reconciliation",
  });
}

async function checkTaxRegistrations(): Promise<void> {
  try {
    await runTaxPreflight(prisma);
  } catch (error) {
    // Tax configuration must never fail the whole reconciliation run.
    appLogger.warn({
      error: error instanceof Error ? error.message : String(error),
      msg: "stripe_reconciliation_tax_check_failed",
    });
  }
}

async function assertPreviousRunFresh(now: Date): Promise<void> {
  const previous = await prisma.billingReconciliationRun.findFirst({
    orderBy: { finishedAt: "desc" },
    select: { finishedAt: true },
    where: { status: "SUCCESS" },
  });

  if (previous?.finishedAt == null) {
    return;
  }

  if (now.getTime() - previous.finishedAt.getTime() > RECONCILIATION_ALERT_MS) {
    await upsertBillingIssue(prisma, {
      dedupeKey: `reconciliation_stale:${previous.finishedAt.toISOString()}`,
      details: { lastSuccess: previous.finishedAt.toISOString() },
      kind: "RECONCILIATION_STALE",
      severity: "CRITICAL",
      source: "stripe_reconciliation",
    });
  }
}

// Reads Stripe and repairs only our DB. It never writes to Stripe.
export async function runStripeReconciliation(
  now: Date = new Date(),
): Promise<ReconciliationSummary> {
  const scheduledForDate = dateOnly(now);
  let runId: string;

  try {
    const run = await prisma.billingReconciliationRun.create({
      data: { scheduledForDate, startedAt: now, status: "RUNNING" },
      select: { id: true },
    });
    runId = run.id;
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { checkedSubscriptions: 0, mismatchCount: 0, runId: null, skipped: true };
    }

    throw error;
  }

  let checkedSubscriptions = 0;
  let mismatchCount = 0;

  try {
    await assertPreviousRunFresh(now);

    const stripe = getStripeClient();
    const seen = new Set<string>();

    for await (const subscription of listAllSubscriptions(stripe)) {
      checkedSubscriptions += 1;
      seen.add(subscription.id);

      if (await reconcileSubscription(subscription, now)) {
        mismatchCount += 1;
      }
    }

    mismatchCount += await reconcileMissingLocal(seen, now);
    mismatchCount += await reconcileLedger(now);
    await checkEventQueue(now);
    await checkTaxRegistrations();

    await prisma.billingReconciliationRun.update({
      data: {
        checkedSubscriptions,
        finishedAt: new Date(),
        mismatchCount,
        status: "SUCCESS",
      },
      where: { id: runId },
    });

    return { checkedSubscriptions, mismatchCount, runId, skipped: false };
  } catch (error) {
    await prisma.billingReconciliationRun.update({
      data: {
        error: error instanceof Error ? error.message.slice(0, 500) : "UNKNOWN_ERROR",
        finishedAt: new Date(),
        status: "FAILED",
      },
      where: { id: runId },
    });

    throw error;
  }
}
