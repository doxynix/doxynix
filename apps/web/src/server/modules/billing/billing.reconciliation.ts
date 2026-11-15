import { Prisma } from "@prisma/client";
import type Stripe from "stripe";

import { appLogger } from "@/server/core/app-logger";
import { upsertBillingIssue } from "@/server/core/billing/issue";
import { captureBillingAlert, recordBillingMetric } from "@/server/core/billing/metrics";
import { syncWorkspaceSeats } from "@/server/core/billing/seat-sync";
import { getStripeClient } from "@/server/core/billing/stripe-client";
import { prisma } from "@/server/core/db";

import { planEntitlements } from "./billing.catalog";
import { STRIPE_PROVIDER } from "./billing.constants";
import { appendLedgerEntry } from "./billing.ledger";
import { fromStripeSubscription } from "./billing.snapshot";
import { isTerminalStatus } from "./billing.state";
import type { ProjectedSubscription } from "./billing.subscriptions";
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

async function* listSubscriptionPages(stripe: Stripe): AsyncGenerator<Stripe.Subscription[]> {
  let startingAfter: string | undefined;

  do {
    const page = await stripe.subscriptions.list({
      expand: ["data.latest_invoice"],
      limit: PAGE_SIZE,
      starting_after: startingAfter,
      status: "all",
    });

    if (page.data.length > 0) {
      yield page.data;
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
    local.externalStatus !== subscription.status ||
    local.externalPriceId !== item.price.id ||
    local.quantity !== (item.quantity ?? 1) ||
    local.currency !== item.price.currency ||
    local.externalSubscriptionItemId !== item.id ||
    seconds(local.currentPeriodStart as Date) !== item.current_period_start ||
    seconds(local.currentPeriodEnd as Date) !== item.current_period_end ||
    local.cancelAtPeriodEnd !== subscription.cancel_at_period_end
  );
}

const ENTITLEMENT_SELECT = {
  aiTokensPerMonth: true,
  analysesPerMonth: true,
  autoResync: true,
  historyDays: true,
  planCode: true,
  privateReposAllowed: true,
  prReviews: true,
  reposLimit: true,
  sourceSubscriptionId: true,
  workspaceId: true,
} as const;

type EntitlementRow = Prisma.WorkspaceEntitlementGetPayload<{ select: typeof ENTITLEMENT_SELECT }>;
type LocalSubscription = Prisma.BillingSubscriptionGetPayload<Record<string, never>>;
type CustomerRef = { id: string; workspaceId: string };

// Built once per Stripe page (100 subscriptions), so the maps stay bounded. A key that was not
// prefetched still falls back to a query: a webhook can project a row while the loop is running.
// `null` in `customers` is a negative cache entry — the page already knows that customer is unowned.
type ReconcileContext = {
  customers: Map<string, CustomerRef | null>;
  entitlements: Map<string, EntitlementRow>;
  memberCounts: Map<string, number>;
  subscriptionIdsByWorkspace: Map<string, Set<string>>;
  subscriptions: Map<string, LocalSubscription>;
};

async function buildPageContext(page: Stripe.Subscription[]): Promise<ReconcileContext> {
  const externalCustomerIds = page.flatMap((subscription) => {
    const customerId = idOf(subscription.customer);

    return customerId == null ? [] : [customerId];
  });

  const [customers, subscriptions] = await Promise.all([
    prisma.billingCustomer.findMany({
      select: { externalCustomerId: true, id: true, workspaceId: true },
      where: { externalCustomerId: { in: externalCustomerIds }, provider: STRIPE_PROVIDER },
    }),
    prisma.billingSubscription.findMany({
      where: { externalSubscriptionId: { in: page.map((subscription) => subscription.id) } },
    }),
  ]);
  const workspaceIds = [...new Set(customers.map((customer) => customer.workspaceId))];
  const [entitlements, memberCounts] = await Promise.all([
    prisma.workspaceEntitlement.findMany({
      select: ENTITLEMENT_SELECT,
      where: { workspaceId: { in: workspaceIds } },
    }),
    prisma.workspaceMember.groupBy({
      _count: { _all: true },
      by: ["workspaceId"],
      where: { workspaceId: { in: workspaceIds } },
    }),
  ]);

  const countByWorkspace = new Map(memberCounts.map((row) => [row.workspaceId, row._count._all]));
  const customerByExternalId: Map<string, CustomerRef | null> = new Map(
    externalCustomerIds.map((externalCustomerId) => [externalCustomerId, null]),
  );
  const subscriptionIdsByWorkspace = new Map<string, Set<string>>();

  for (const customer of customers) {
    customerByExternalId.set(customer.externalCustomerId, {
      id: customer.id,
      workspaceId: customer.workspaceId,
    });
  }

  for (const local of subscriptions) {
    const ids = subscriptionIdsByWorkspace.get(local.workspaceId) ?? new Set<string>();

    ids.add(local.externalSubscriptionId);
    subscriptionIdsByWorkspace.set(local.workspaceId, ids);
  }

  return {
    customers: customerByExternalId,
    entitlements: new Map(
      entitlements.map((entitlement) => [entitlement.workspaceId, entitlement]),
    ),
    // `groupBy` omits workspaces without members; 0 is the truth for those, not a cache miss.
    memberCounts: new Map(workspaceIds.map((id) => [id, countByWorkspace.get(id) ?? 0])),
    subscriptionIdsByWorkspace,
    subscriptions: new Map(subscriptions.map((local) => [local.externalSubscriptionId, local])),
  };
}

// A repair rewrites the mirror, the entitlement and the previous holder's `isCurrent`, so later
// subscriptions on the same page must re-read that workspace instead of trusting the prefetch.
function forgetWorkspaceState(ctx: ReconcileContext, workspaceId: string): void {
  ctx.entitlements.delete(workspaceId);

  for (const externalSubscriptionId of ctx.subscriptionIdsByWorkspace.get(workspaceId) ?? []) {
    ctx.subscriptions.delete(externalSubscriptionId);
  }
}

async function customerFor(customerId: string, ctx: ReconcileContext): Promise<null | CustomerRef> {
  const known = ctx.customers.get(customerId);

  if (known !== undefined) {
    return known;
  }

  const found = await prisma.billingCustomer.findFirst({
    select: { id: true, workspaceId: true },
    where: { externalCustomerId: customerId, provider: STRIPE_PROVIDER },
  });

  ctx.customers.set(customerId, found);

  return found;
}

async function localFor(
  externalSubscriptionId: string,
  ctx: ReconcileContext,
): Promise<LocalSubscription | null> {
  const known = ctx.subscriptions.get(externalSubscriptionId);

  if (known != null) {
    return known;
  }

  return prisma.billingSubscription.findUnique({ where: { externalSubscriptionId } });
}

async function entitlementFor(
  workspaceId: string,
  ctx: ReconcileContext,
): Promise<EntitlementRow | null> {
  const known = ctx.entitlements.get(workspaceId);

  if (known != null) {
    return known;
  }

  return prisma.workspaceEntitlement.findUnique({
    select: ENTITLEMENT_SELECT,
    where: { workspaceId },
  });
}

async function memberCountFor(workspaceId: string, ctx: ReconcileContext): Promise<number> {
  const known = ctx.memberCounts.get(workspaceId);

  if (known != null) {
    return known;
  }

  return prisma.workspaceMember.count({ where: { workspaceId } });
}

async function unownedIssue(externalObjectId: string): Promise<void> {
  await upsertBillingIssue(prisma, {
    dedupeKey: `unowned:${externalObjectId}`,
    details: { source: "reconciliation" },
    externalObjectId,
    kind: "UNOWNED_STRIPE_OBJECT",
    severity: "CRITICAL",
    source: "reconciliation",
  });
}

async function repair(
  subscription: Stripe.Subscription,
  ownership: { billingCustomerId: string; customerId: null | string; workspaceId: string },
  now: Date,
  options: { allowTakeover?: boolean } = {},
): Promise<ProjectedSubscription> {
  return prisma.$transaction(async (tx) =>
    projectSubscription(tx, {
      allowCurrentTakeover: options.allowTakeover === true,
      now,
      ownership,
      snapshot: fromStripeSubscription(subscription),
    }),
  );
}

async function currentSlotHolder(
  subscriptionId: string,
  workspaceId: string,
): Promise<null | { externalStatus: string; externalSubscriptionId: string }> {
  return prisma.billingSubscription.findFirst({
    select: { externalStatus: true, externalSubscriptionId: true },
    where: {
      externalSubscriptionId: { not: subscriptionId },
      isCurrent: true,
      workspaceId,
    },
  });
}

// Replacing a current subscription is allowed only for a terminal holder confirmed by Stripe: the
// mirror can be stale, and evicting a paid subscription on stale data is worse than waiting.
async function holderIsTerminal(holder: {
  externalStatus: string;
  externalSubscriptionId: string;
}): Promise<boolean> {
  if (!isTerminalStatus(holder.externalStatus)) {
    return false;
  }

  try {
    const canonical = await getStripeClient().subscriptions.retrieve(holder.externalSubscriptionId);

    return isTerminalStatus(canonical.status);
  } catch (error) {
    if (isMissingResource(error)) {
      return true;
    }

    throw error;
  }
}

function entitlementLimitsStale(entitlement: EntitlementRow | null): boolean {
  if (entitlement == null) {
    return true;
  }

  const plan =
    entitlement.planCode === "TEAM"
      ? planEntitlements("TEAM")
      : entitlement.planCode === "PRO"
        ? planEntitlements("PRO")
        : planEntitlements("HOBBY");

  return (
    entitlement.aiTokensPerMonth !== plan.aiTokensPerMonth ||
    entitlement.analysesPerMonth !== plan.analysesPerMonth ||
    entitlement.autoResync !== plan.autoResync ||
    entitlement.historyDays !== plan.historyDays ||
    entitlement.privateReposAllowed !== plan.privateReposAllowed ||
    entitlement.prReviews !== plan.prReviews ||
    entitlement.reposLimit !== plan.reposLimit
  );
}

async function reconcileSubscription(
  subscription: Stripe.Subscription,
  now: Date,
  ctx: ReconcileContext,
): Promise<boolean> {
  const customerId = idOf(subscription.customer);
  const mapping = customerId == null ? null : await customerFor(customerId, ctx);
  const local = await localFor(subscription.id, ctx);

  if (mapping == null) {
    // Never guess a tenant: an object without a workspace mapping is fail-closed.
    await unownedIssue(subscription.id);

    return true;
  }

  if (local == null) {
    const holder = await currentSlotHolder(subscription.id, mapping.workspaceId);
    const takeover =
      !isTerminalStatus(subscription.status) && holder != null && (await holderIsTerminal(holder));

    await repair(
      subscription,
      { billingCustomerId: mapping.id, customerId, workspaceId: mapping.workspaceId },
      now,
      { allowTakeover: takeover },
    );
    forgetWorkspaceState(ctx, mapping.workspaceId);

    return true;
  }

  if (local.workspaceId !== mapping.workspaceId) {
    await upsertBillingIssue(prisma, {
      dedupeKey: `owner_mismatch:${subscription.id}`,
      details: { localWorkspaceId: local.workspaceId },
      externalObjectId: subscription.id,
      kind: "OWNER_MISMATCH",
      severity: "CRITICAL",
      source: "reconciliation",
      workspaceId: local.workspaceId,
    });

    return true;
  }

  const entitlement = await entitlementFor(mapping.workspaceId, ctx);
  const ownsEntitlement =
    local.isCurrent === true || entitlement?.sourceSubscriptionId === local.id;

  // Repair the mirror first: seat sync reads it to decide whether the subscription is billable,
  // and a stale `past_due` row would make it skip while Stripe is already `active`.
  let changed = false;

  // `needsReview` means the worker refused a transition; the canonical read has happened here, so
  // a workspace stuck in REVIEW with a matching mirror must still be recomputed. Stale plan limits
  // are repaired too: without a fresh event a PRO row written before the catalog carried limits
  // would stay on HOBBY quotas. Only the owning subscription may heal the entitlement, so the
  // limits check stays out of the historical path to avoid a repair every run.
  const holder = ownsEntitlement
    ? null
    : await currentSlotHolder(subscription.id, mapping.workspaceId);
  const live = !isTerminalStatus(subscription.status);
  // The slot is free once the holder's terminal event has landed; a terminal holder is replaced
  // only after Stripe confirms it.
  const slotFreed = !ownsEntitlement && live && holder == null;
  const takeover = !ownsEntitlement && live && holder != null && (await holderIsTerminal(holder));

  let projected: null | ProjectedSubscription = null;

  if (
    differs(local, subscription) ||
    local.needsReview ||
    (ownsEntitlement && entitlementLimitsStale(entitlement)) ||
    slotFreed ||
    takeover
  ) {
    projected = await repair(
      subscription,
      { billingCustomerId: mapping.id, customerId, workspaceId: mapping.workspaceId },
      now,
      { allowTakeover: takeover },
    );
    forgetWorkspaceState(ctx, mapping.workspaceId);
    changed = true;
  }

  // Seats are derived from membership, not from the local mirror: a failed or skipped post-commit
  // sync would otherwise leave the customer paying for a seat that no longer exists.
  const item = itemOf(subscription);
  const members = await memberCountFor(mapping.workspaceId, ctx);

  if (
    (projected?.ownsAccess ?? ownsEntitlement) &&
    subscription.status === "active" &&
    item != null &&
    (item.quantity ?? 1) !== Math.max(1, members)
  ) {
    await syncWorkspaceSeats({
      requestId: `reconcile:${subscription.id}:${now.getTime()}`,
      workspaceId: mapping.workspaceId,
    });
    forgetWorkspaceState(ctx, mapping.workspaceId);

    changed = true;
  }

  return changed;
}

async function reconcileMissingLocal(seen: Set<string>, now: Date): Promise<number> {
  const stripe = getStripeClient();
  const locals = await prisma.billingSubscription.findMany({
    select: { externalSubscriptionId: true, workspaceId: true },
    where: { isCurrent: true },
  });
  const drifted = locals.filter((local) => !seen.has(local.externalSubscriptionId));

  if (drifted.length === 0) {
    return 0;
  }

  let mismatches = 0;
  const present: Array<{
    customerId: null | string;
    externalSubscriptionId: string;
    subscription: Stripe.Subscription;
    workspaceId: string;
  }> = [];

  for (const local of drifted) {
    try {
      // A direct retrieve separates a pagination gap from a genuinely deleted subscription.
      const subscription = await stripe.subscriptions.retrieve(local.externalSubscriptionId, {
        expand: ["latest_invoice"],
      });

      present.push({
        customerId: idOf(subscription.customer),
        externalSubscriptionId: local.externalSubscriptionId,
        subscription,
        workspaceId: local.workspaceId,
      });
    } catch (error) {
      if (!isMissingResource(error)) {
        throw error;
      }

      await prisma.billingSubscription.updateMany({
        data: { needsReview: true, reviewReason: "MISSING_IN_STRIPE" },
        where: { externalSubscriptionId: local.externalSubscriptionId },
      });
      await prisma.workspaceEntitlement.updateMany({
        data: { accessState: "REVIEW" },
        where: { workspaceId: local.workspaceId },
      });
      await upsertBillingIssue(prisma, {
        dedupeKey: `missing_in_stripe:${local.externalSubscriptionId}`,
        details: {},
        externalObjectId: local.externalSubscriptionId,
        kind: "MISSING_IN_STRIPE",
        severity: "CRITICAL",
        source: "reconciliation",
        workspaceId: local.workspaceId,
      });

      mismatches += 1;
    }
  }

  if (present.length === 0) {
    return mismatches;
  }

  // The customer mapping is only known after the Stripe reads, so it is resolved once for the whole
  // drifted set instead of once per subscription.
  const customers = await prisma.billingCustomer.findMany({
    select: { externalCustomerId: true, id: true },
    where: {
      externalCustomerId: {
        in: present.flatMap((item) => (item.customerId == null ? [] : [item.customerId])),
      },
      provider: STRIPE_PROVIDER,
    },
  });
  const customerIdByExternalId = new Map(
    customers.map((customer) => [customer.externalCustomerId, customer.id]),
  );

  for (const item of present) {
    const billingCustomerId =
      item.customerId == null ? undefined : customerIdByExternalId.get(item.customerId);

    if (billingCustomerId != null) {
      await repair(
        item.subscription,
        { billingCustomerId, customerId: item.customerId, workspaceId: item.workspaceId },
        now,
      );
    }

    mismatches += 1;
  }

  return mismatches;
}

async function reconcileLedger(now: Date): Promise<number> {
  const stripe = getStripeClient();
  const entries = await prisma.billingLedgerEntry.findMany({
    select: { amount: true, currency: true, externalObjectId: true, id: true, workspaceId: true },
    where: {
      kind: "INVOICE_PAID",
      occurredAt: { gte: new Date(now.getTime() - LEDGER_LOOKBACK_MS) },
    },
  });
  let mismatches = 0;

  for (const entry of entries) {
    let invoice: Stripe.Invoice;

    try {
      invoice = await stripe.invoices.retrieve(entry.externalObjectId);
    } catch (error) {
      if (!isMissingResource(error)) {
        throw error;
      }

      await upsertBillingIssue(prisma, {
        dedupeKey: `missing_invoice:${entry.externalObjectId}`,
        details: {},
        externalObjectId: entry.externalObjectId,
        kind: "MISSING_INVOICE",
        severity: "CRITICAL",
        source: "reconciliation",
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
      externalObjectId: entry.externalObjectId,
      kind: "INVOICE_PAID_CORRECTION",
      occurredAt: now,
      relatedInvoiceId: invoice.id,
      status: `correction:${expected - entry.amount}`,
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
    source: "reconciliation",
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
    captureBillingAlert("RECONCILIATION_STALE", {
      lastSuccess: previous.finishedAt.toISOString(),
    });

    await upsertBillingIssue(prisma, {
      dedupeKey: `reconciliation_stale:${previous.finishedAt.toISOString()}`,
      details: { lastSuccess: previous.finishedAt.toISOString() },
      kind: "RECONCILIATION_STALE",
      severity: "CRITICAL",
      source: "reconciliation",
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
  const startedAt = Date.now();

  try {
    await assertPreviousRunFresh(now);

    const stripe = getStripeClient();
    const seen = new Set<string>();

    for await (const page of listSubscriptionPages(stripe)) {
      const context = await buildPageContext(page);

      for (const subscription of page) {
        checkedSubscriptions += 1;
        seen.add(subscription.id);

        if (await reconcileSubscription(subscription, now, context)) {
          mismatchCount += 1;
        }
      }
    }

    mismatchCount += await reconcileMissingLocal(seen, now);
    mismatchCount += await reconcileLedger(now);
    await checkEventQueue(now);
    await checkTaxRegistrations();

    const finishedAt = new Date();

    await prisma.billingReconciliationRun.update({
      data: {
        checkedSubscriptions,
        finishedAt,
        mismatchCount,
        status: "SUCCESS",
      },
      where: { id: runId },
    });

    recordBillingMetric(
      "billing_reconciliation_duration_seconds",
      (Date.now() - startedAt) / 1000,
      {},
    );
    recordBillingMetric("billing_reconciliation_mismatches_total", mismatchCount, {});
    recordBillingMetric(
      "billing_reconciliation_last_success_timestamp",
      Math.floor(finishedAt.getTime() / 1000),
      {},
    );

    return { checkedSubscriptions, mismatchCount, runId, skipped: false };
  } catch (error) {
    captureBillingAlert("RECONCILIATION_FAILED", {});

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
