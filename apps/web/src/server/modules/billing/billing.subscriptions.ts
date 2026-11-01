import type { AccessState } from "@doxynix/shared";

import { upsertBillingIssue } from "@/server/core/billing/issue";
import { recordBillingMetric } from "@/server/core/billing/metrics";
import type { DbClient } from "@/server/core/db";
import { DEFAULT_ACCESS_STATE, isAccessState } from "@/server/core/entitlements/state";

import { planEntitlements } from "./billing.catalog";
import { NonRetryableBillingError } from "./billing.errors";
import type { BillingOwnership } from "./billing.resolver";
import type { SubscriptionSnapshot } from "./billing.snapshot";
import { decideAccessState, isTerminalStatus } from "./billing.state";

export type ProjectedSubscription = {
  accessState: AccessState;
  mirrorId: string;
  // False for a historical subscription: its mirror was refreshed but access was left untouched.
  ownsAccess: boolean;
  reviewReason: null | string;
};

function currentAccessState(value: null | string | undefined): AccessState {
  if (value == null) {
    return DEFAULT_ACCESS_STATE;
  }

  return isAccessState(value) ? value : "REVIEW";
}

// Projects the canonical Subscription into the mirror and the entitlement in one transaction. The
// entitlement state is derived from the transition table, never from the snapshot in the event.
export async function projectSubscription(
  tx: DbClient,
  input: {
    now: Date;
    ownership: BillingOwnership;
    snapshot: SubscriptionSnapshot;
    // The caller (reconciliation) proved from Stripe that the current slot holder is terminal.
    allowCurrentTakeover?: boolean;
    // Operator resolution of a revoked terminal id: skip the revival guard for this projection.
    overrideRevivedTerminal?: boolean;
  },
): Promise<ProjectedSubscription> {
  const { ownership, snapshot } = input;
  // An extra item (an add-on added in the Dashboard) would otherwise be ignored silently while the
  // first one keeps deciding the plan and the seat count.
  const multipleItems = snapshot.itemCount > 1;

  if (ownership.billingCustomerId == null) {
    throw new NonRetryableBillingError(
      "CUSTOMER_MAPPING_MISSING",
      `No billing customer mapping for subscription ${snapshot.externalSubscriptionId}`,
    );
  }

  const existing = await tx.billingSubscription.findUnique({
    select: {
      activatedAt: true,
      externalStatus: true,
      graceEndsAt: true,
      id: true,
      isCurrent: true,
      needsReview: true,
      reviewReason: true,
    },
    where: { externalSubscriptionId: snapshot.externalSubscriptionId },
  });

  const entitlement = await tx.workspaceEntitlement.findUnique({
    select: {
      accessState: true,
      activatedAt: true,
      aiTokensPerMonth: true,
      analysesPerMonth: true,
      autoResync: true,
      historyDays: true,
      planCode: true,
      privateReposAllowed: true,
      prReviews: true,
      reposLimit: true,
      sourceSubscriptionId: true,
    },
    where: { workspaceId: ownership.workspaceId },
  });

  const terminal = isTerminalStatus(snapshot.status);
  const otherCurrent = await tx.billingSubscription.findFirst({
    select: { externalStatus: true },
    where: {
      externalSubscriptionId: { not: snapshot.externalSubscriptionId },
      isCurrent: true,
      workspaceId: ownership.workspaceId,
    },
  });

  // Only the subscription that already holds access may rewrite it, or one that finds the slot
  // free, or one the caller proved can replace a terminal holder. A late or replayed event for a
  // historical id updates its own mirror and nothing else: otherwise it can downgrade the live
  // plan or take the current slot from the subscription the entitlement points at. A terminal
  // current row is released by its own event; replacing it needs a canonical read first.
  const ownsAccess =
    existing?.isCurrent === true ||
    otherCurrent == null ||
    (!terminal &&
      input.allowCurrentTakeover === true &&
      isTerminalStatus(otherCurrent.externalStatus));

  // Lost `invoice.paid` must not leave a paying customer in PENDING for a month: a paid latest
  // invoice on an active subscription is proof enough, and activation stays idempotent.
  const paidAt = snapshot.paidAt;
  let activatedAt = existing?.activatedAt ?? null;

  if (
    activatedAt == null &&
    paidAt != null &&
    (snapshot.status === "active" || snapshot.status === "trialing")
  ) {
    // Records activation on an existing mirror; on the very first projection the row does not
    // exist yet, so the value is carried into the `create` below instead of being lost.
    await markSubscriptionActivated(tx, {
      activatedAt: paidAt,
      externalSubscriptionId: snapshot.externalSubscriptionId,
    });

    activatedAt = paidAt;
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
      previousStatus:
        input.overrideRevivedTerminal === true ? null : (existing?.externalStatus ?? null),
      priceKnown: snapshot.priceKnown,
      status: snapshot.status,
    },
  });

  let accessState = decision.accessState;
  let reviewReason = decision.reviewReason;

  if (multipleItems) {
    accessState = "REVIEW";
    reviewReason = "MULTIPLE_ITEMS";
  }

  // A revived terminal id stays in REVIEW until an operator clears it: otherwise the next event
  // sees the already-overwritten mirror status and silently returns ACTIVE.
  const stickyReview =
    existing?.needsReview === true &&
    existing.reviewReason === "REVIVED_TERMINAL_SUBSCRIPTION" &&
    decision.accessState === "ACTIVE";

  if (stickyReview) {
    accessState = "REVIEW";
    reviewReason = existing.reviewReason ?? null;
  }

  if (ownsAccess) {
    recordBillingMetric("billing_subscription_transition_total", 1, {
      from: current,
      to: accessState,
    });
    recordBillingMetric("billing_entitlement_total", 1, { state: accessState });
  }

  const isCurrent = ownsAccess ? (terminal ? null : true) : (existing?.isCurrent ?? null);
  // Only the PRO price exists in the catalog, so a non-terminal subscription means PRO — unless
  // the workspace is already on TEAM, which no Stripe price maps to and must not be downgraded.
  const planCode = terminal ? "HOBBY" : entitlement?.planCode === "TEAM" ? "TEAM" : "PRO";
  const planChanged = entitlement?.planCode !== planCode;
  // Paid features and quotas live in the projection, never in Stripe: flipping `planCode` without
  // them would sell PRO at HOBBY limits. Terminal subscriptions fall back to the HOBBY row.
  const plan = planEntitlements(planCode);
  // A row written before the plan carried limits (or by `handleUnownedEvent`) must heal even when
  // the plan code itself did not change.
  const planStale =
    entitlement != null &&
    (entitlement.aiTokensPerMonth !== plan.aiTokensPerMonth ||
      entitlement.analysesPerMonth !== plan.analysesPerMonth ||
      entitlement.autoResync !== plan.autoResync ||
      entitlement.historyDays !== plan.historyDays ||
      entitlement.privateReposAllowed !== plan.privateReposAllowed ||
      entitlement.prReviews !== plan.prReviews ||
      entitlement.reposLimit !== plan.reposLimit);
  const writePlan = planChanged || planStale;
  const requestedSeats = snapshot.quantity;
  const activeMembers = await tx.workspaceMember.count({
    where: { workspaceId: ownership.workspaceId },
  });

  // Stripe can report fewer seats than the workspace already has (race, manual change in the
  // Dashboard). Paid seats are the billing truth: surface the gap instead of gifting capacity.
  if (ownsAccess && !terminal && requestedSeats < activeMembers) {
    await upsertBillingIssue(tx, {
      dedupeKey: `seats_below_members:${snapshot.externalSubscriptionId}`,
      details: { activeMembers, requestedSeats },
      externalObjectId: snapshot.externalSubscriptionId,
      kind: "SEATS_BELOW_MEMBERS",
      severity: "WARNING",
      source: "worker",
      workspaceId: ownership.workspaceId,
    });
  }

  const seatLimit = terminal ? 0 : requestedSeats;
  const {
    cancelAt,
    cancelAtPeriodEnd,
    currentPeriodEnd,
    currentPeriodStart,
    currency,
    externalSubscriptionId,
    externalSubscriptionItemId,
    latestInvoiceId,
    latestInvoiceStatus,
    priceId,
  } = snapshot;
  const needsReview = ownsAccess && accessState === "REVIEW";
  const persistedReviewReason = ownsAccess ? reviewReason : null;

  // A live subscription the entitlement does not point at is never silent: it is mirrored as
  // history and surfaced, otherwise Stripe keeps billing something nobody in the workspace sees.
  if (!ownsAccess && !terminal) {
    await upsertBillingIssue(tx, {
      dedupeKey: `duplicate_active:${snapshot.externalSubscriptionId}`,
      details: { subscriptionStatus: snapshot.status },
      externalObjectId: snapshot.externalSubscriptionId,
      kind: "DUPLICATE_ACTIVE_SUBSCRIPTION",
      severity: "CRITICAL",
      source: "worker",
      workspaceId: ownership.workspaceId,
    });
  }

  // A review state is not silent: without an issue nobody learns that a paying workspace lost
  // access and reconciliation has nothing to resolve.
  if (ownsAccess && reviewReason != null) {
    await upsertBillingIssue(tx, {
      dedupeKey: `subscription_review:${snapshot.externalSubscriptionId}:${reviewReason}`,
      details: { reason: reviewReason, status: snapshot.status },
      externalObjectId: snapshot.externalSubscriptionId,
      kind: "SUBSCRIPTION_REVIEW",
      severity: "CRITICAL",
      source: "worker",
      workspaceId: ownership.workspaceId,
    });
  } else if (ownsAccess && accessState === "ACTIVE") {
    // Leaving REVIEW closes the issue that made the state visible, otherwise operators keep an
    // open critical issue for a workspace that already recovered.
    await tx.billingIssue.updateMany({
      data: { resolvedAt: new Date(), status: "RESOLVED" },
      where: {
        dedupeKey: { startsWith: `subscription_review:${snapshot.externalSubscriptionId}:` },
        status: "OPEN",
      },
    });
  }

  // The duplicate is now the live subscription; whichever state it lands in (PENDING, GRACE,
  // SUSPENDED), the issue that reported it outside the current slot is stale.
  if (ownsAccess) {
    await tx.billingIssue.updateMany({
      data: { resolvedAt: new Date(), status: "RESOLVED" },
      where: {
        dedupeKey: `duplicate_active:${snapshot.externalSubscriptionId}`,
        status: "OPEN",
      },
    });
  }

  // Frees the single current slot before the upsert; history stays null, never false.
  if (ownsAccess && isCurrent != null) {
    await tx.billingSubscription.updateMany({
      data: { isCurrent: null },
      where: {
        externalSubscriptionId: { not: snapshot.externalSubscriptionId },
        isCurrent: true,
        workspaceId: ownership.workspaceId,
      },
    });
  }

  const mirror = await tx.billingSubscription.upsert({
    create: {
      activatedAt,
      billingCustomerId: ownership.billingCustomerId,
      cancelAt,
      cancelAtPeriodEnd,
      currency,
      currentPeriodEnd,
      currentPeriodStart,
      externalPriceId: priceId,
      externalStatus: snapshot.status,
      externalSubscriptionId,
      externalSubscriptionItemId,
      isCurrent,
      latestInvoiceId,
      latestInvoiceStatus,
      needsReview,
      quantity: snapshot.quantity,
      reviewReason: persistedReviewReason,
      workspaceId: ownership.workspaceId,
    },
    update: {
      cancelAt,
      cancelAtPeriodEnd,
      currency,
      currentPeriodEnd,
      currentPeriodStart,
      isCurrent,
      latestInvoiceId,
      ...(latestInvoiceStatus == null ? {} : { latestInvoiceStatus }),
      needsReview,
      quantity: snapshot.quantity,
      reviewReason: persistedReviewReason,
      // Only an ACTIVE canonical subscription ends the dunning window; a paid invoice alone does
      // not prove recovery while Stripe still reports `past_due`.
      ...(accessState === "ACTIVE"
        ? { graceEndsAt: null, needsAction: null, pastDueStartedAt: null }
        : {}),
      externalPriceId: priceId,
      externalStatus: snapshot.status,
      externalSubscriptionItemId,
    },
    where: { externalSubscriptionId },
  });

  const accessStateChanged = current !== accessState;

  if (ownsAccess) {
    await tx.workspaceEntitlement.upsert({
      create: {
        accessState: accessState,
        activatedAt: accessState === "ACTIVE" ? (entitlement?.activatedAt ?? activatedAt) : null,
        graceEndsAt: accessState === "GRACE" ? (existing?.graceEndsAt ?? null) : null,
        planCode,
        revision: BigInt(1),
        seatLimit,
        sourceSubscriptionId: mirror.id,
        workspaceId: ownership.workspaceId,
        ...plan,
      },
      update: {
        accessState: accessState,
        activatedAt:
          accessState === "ACTIVE" && entitlement?.activatedAt == null ? activatedAt : undefined,
        // The reader (`hasAccess`) requires a live deadline for GRACE; without this column the whole
        // grace window is dead and a paying customer is blocked on the first failed payment.
        graceEndsAt: accessState === "GRACE" ? (existing?.graceEndsAt ?? null) : null,
        planCode,
        revision: accessStateChanged ? { increment: 1 } : undefined,
        seatLimit,
        sourceSubscriptionId: mirror.id,
        // Limits are only rewritten on a plan change or when the row is stale, so a manual
        // adjustment survives ordinary renewal events instead of being reset every month.
        ...(writePlan ? plan : {}),
      },
      where: { workspaceId: ownership.workspaceId },
    });
  }

  return {
    accessState: ownsAccess ? accessState : current,
    mirrorId: mirror.id,
    ownsAccess,
    reviewReason: persistedReviewReason,
  };
}

// Activation is recorded once. A later renewal or a duplicate `invoice.paid` must not move the
// timestamp that proves when access was first granted.
export async function markSubscriptionActivated(
  db: DbClient,
  input: { activatedAt: Date; externalSubscriptionId: string },
): Promise<boolean> {
  const updated = await db.billingSubscription.updateMany({
    data: { activatedAt: input.activatedAt },
    where: { activatedAt: null, externalSubscriptionId: input.externalSubscriptionId },
  });

  return updated.count > 0;
}
