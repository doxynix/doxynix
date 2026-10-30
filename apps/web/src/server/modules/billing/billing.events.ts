import type { Prisma } from "@prisma/client";
import { tasks } from "@trigger.dev/sdk";
import type Stripe from "stripe";

import { appLogger } from "@/server/core/app-logger";
import { type DbClient, prisma } from "@/server/core/db";

import { PROCESS_STRIPE_EVENT_TASK_ID, STRIPE_API_VERSION } from "./billing.constants";
import { NonRetryableBillingError } from "./billing.errors";
import { applyInvoiceEvent, retrieveSubscriptionForInvoice } from "./billing.invoices";
import { upsertBillingIssue } from "./billing.issues";
import {
  type BillingOwnership,
  type CanonicalStripeObject,
  resolveCanonicalObject,
  resolveOwnership,
  type StoredStripeEvent,
} from "./billing.resolver";
import { applyRiskEvent, isRiskObject, resolveRiskLinks } from "./billing.risk";
import { projectSubscription } from "./billing.subscriptions";

const EVENT_STATUS = {
  DEAD_LETTER: "DEAD_LETTER",
  ENQUEUED: "ENQUEUED",
  PROCESSED: "PROCESSED",
  PROCESSING: "PROCESSING",
  RECEIVED: "RECEIVED",
} as const;

const STALE_EVENT_MS = 15 * 60 * 1000;
const SWEEP_BATCH_SIZE = 50;

export type StripeEventOutcome = { status: "processed" | "skipped" | "unowned" };

function idOf(value: null | string | { id: string } | undefined): null | string {
  if (value == null) {
    return null;
  }

  return typeof value === "string" ? value : value.id;
}

function parseStoredEvent(payload: Prisma.JsonValue | null): StoredStripeEvent {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new NonRetryableBillingError("SCHEMA_MISMATCH", "Stored event payload is not an object");
  }

  const event = payload as Record<string, unknown>;
  const data = event.data;

  if (typeof event.id !== "string" || typeof event.type !== "string") {
    throw new NonRetryableBillingError("SCHEMA_MISMATCH", "Stored event is missing id or type");
  }

  if (typeof data !== "object" || data == null) {
    throw new NonRetryableBillingError("SCHEMA_MISMATCH", "Stored event is missing data");
  }

  const object = (data as Record<string, unknown>).object;

  if (typeof object !== "object" || object == null) {
    throw new NonRetryableBillingError("SCHEMA_MISMATCH", "Stored event is missing data.object");
  }

  if (typeof (object as Record<string, unknown>).id !== "string") {
    throw new NonRetryableBillingError("SCHEMA_MISMATCH", "Stored event object has no id");
  }

  return payload as unknown as StoredStripeEvent;
}

async function markProcessed(tx: DbClient, billingEventId: string): Promise<void> {
  await tx.billingEvent.update({
    data: { lastError: null, processedAt: new Date(), status: EVENT_STATUS.PROCESSED },
    where: { id: billingEventId },
  });
}

async function knownWorkspaceFor(
  db: DbClient,
  canonical: CanonicalStripeObject,
): Promise<null | string> {
  if (canonical.kind !== "subscription") {
    return null;
  }

  const row = await db.billingSubscription.findUnique({
    select: { workspaceId: true },
    where: { stripeSubscriptionId: canonical.subscription.id },
  });

  return row?.workspaceId ?? null;
}

// Unowned objects are never guessed onto a workspace. If the object was projected before, the old
// workspace goes to REVIEW; otherwise only the issue is recorded.
async function handleUnownedEvent(
  billingEventId: string,
  event: StoredStripeEvent,
  canonical: CanonicalStripeObject,
): Promise<void> {
  const knownWorkspaceId = await knownWorkspaceFor(prisma, canonical);

  await prisma.$transaction(async (tx) => {
    if (knownWorkspaceId != null) {
      await tx.workspaceEntitlement.upsert({
        create: {
          accessState: "REVIEW",
          planCode: "PRO",
          seatLimit: 0,
          workspaceId: knownWorkspaceId,
        },
        update: { accessState: "REVIEW", revision: { increment: 1 } },
        where: { workspaceId: knownWorkspaceId },
      });
    }

    await upsertBillingIssue(tx, {
      dedupeKey: `unowned:${event.id}`,
      details: { type: event.type },
      kind: "UNOWNED_STRIPE_OBJECT",
      severity: "CRITICAL",
      source: "stripe_worker",
      stripeObjectId: event.data.object.id,
      workspaceId: knownWorkspaceId,
    });

    await markProcessed(tx, billingEventId);
  });

  appLogger.error({
    billingEventId,
    msg: "stripe_event_unowned_object",
    stripeObjectId: event.data.object.id,
    type: event.type,
  });
}

async function assertOwnerMatches(
  subscription: Stripe.Subscription,
  workspaceId: string,
): Promise<void> {
  const existing = await prisma.billingSubscription.findUnique({
    select: { workspaceId: true },
    where: { stripeSubscriptionId: subscription.id },
  });

  if (existing != null && existing.workspaceId !== workspaceId) {
    throw new NonRetryableBillingError(
      "OWNER_MISMATCH",
      `Subscription ${subscription.id} belongs to another workspace`,
    );
  }
}

// The Checkout row is the Session↔Workspace link; the session status is the only field the mirror
// keeps. Access is granted by the subscription projection, never by a completed Checkout.
function checkoutSessionStatus(eventType: string, session: Stripe.Checkout.Session): null | string {
  if (eventType === "checkout.session.completed") {
    return "complete";
  }

  if (eventType === "checkout.session.expired") {
    return "expired";
  }

  return session.status ?? null;
}

async function applyCheckoutSession(
  tx: DbClient,
  ownership: BillingOwnership,
  session: Stripe.Checkout.Session,
  eventType: string,
): Promise<void> {
  const stripeStatus = checkoutSessionStatus(eventType, session);

  await tx.billingCheckoutSession.upsert({
    create: {
      stripeCheckoutSessionId: session.id,
      stripeCustomerId: ownership.customerId ?? idOf(session.customer) ?? "",
      stripeStatus,
      workspaceId: ownership.workspaceId,
    },
    update: { stripeStatus },
    where: { stripeCheckoutSessionId: session.id },
  });
}

export async function processStripeEvent(billingEventId: string): Promise<StripeEventOutcome> {
  const stored = await prisma.billingEvent.findUnique({
    select: { id: true, payload: true, status: true },
    where: { id: billingEventId },
  });

  if (stored == null) {
    throw new NonRetryableBillingError(
      "EVENT_NOT_FOUND",
      `Billing event not found: ${billingEventId}`,
    );
  }

  if (stored.status === EVENT_STATUS.PROCESSED) {
    return { status: "skipped" };
  }

  await prisma.billingEvent.update({
    data: { attempts: { increment: 1 }, status: EVENT_STATUS.PROCESSING },
    where: { id: billingEventId },
  });

  const event = parseStoredEvent(stored.payload);

  if (event.api_version != null && event.api_version !== STRIPE_API_VERSION) {
    throw new NonRetryableBillingError(
      "UNKNOWN_API_VERSION",
      `Unsupported API version: ${event.api_version}`,
    );
  }

  const canonical = await resolveCanonicalObject(event);
  const ownership = await resolveOwnership(prisma, canonical);

  if (ownership == null) {
    await handleUnownedEvent(billingEventId, event, canonical);

    return { status: "unowned" };
  }

  if (canonical.kind === "subscription") {
    await assertOwnerMatches(canonical.subscription, ownership.workspaceId);
  }

  const now = new Date();
  // Stripe reads happen before the transaction; only DB writes hold it.
  const invoiceSubscription =
    canonical.kind === "invoice" ? await retrieveSubscriptionForInvoice(canonical.invoice) : null;
  const riskLinks = isRiskObject(canonical) ? await resolveRiskLinks(canonical) : null;

  await prisma.$transaction(async (tx) => {
    if (canonical.kind === "subscription") {
      await projectSubscription(tx, {
        now,
        ownership,
        subscription: canonical.subscription,
      });
    } else if (canonical.kind === "checkout_session") {
      await applyCheckoutSession(tx, ownership, canonical.session, event.type);
    } else if (canonical.kind === "invoice") {
      await applyInvoiceEvent(tx, {
        billingEventId,
        eventCreatedAt: event.created == null ? now : new Date(event.created * 1000),
        eventType: event.type,
        invoice: canonical.invoice,
        now,
        ownership,
        subscription: invoiceSubscription,
      });
    } else if (isRiskObject(canonical) && riskLinks != null) {
      await applyRiskEvent(tx, {
        billingEventId,
        canonical,
        links: riskLinks,
        ownership,
      });
    }

    await markProcessed(tx, billingEventId);
  });

  appLogger.info({ billingEventId, msg: "stripe_event_processed", type: event.type });

  return { status: "processed" };
}

export async function markEventDeadLetter(billingEventId: string, error: unknown): Promise<void> {
  const stored = await prisma.billingEvent.findUnique({
    select: { stripeEventId: true, type: true },
    where: { id: billingEventId },
  });
  const message = error instanceof Error ? error.message.slice(0, 500) : "UNKNOWN_ERROR";

  await prisma.$transaction(async (tx) => {
    await tx.billingEvent.update({
      data: { lastError: message, status: EVENT_STATUS.DEAD_LETTER },
      where: { id: billingEventId },
    });

    await upsertBillingIssue(tx, {
      dedupeKey: `dead_letter:${stored?.stripeEventId ?? billingEventId}`,
      details: { type: stored?.type ?? "unknown" },
      kind: "EVENT_DEAD_LETTER",
      severity: "CRITICAL",
      source: "stripe_worker",
      stripeObjectId: stored?.stripeEventId ?? null,
    });
  });

  appLogger.error({ billingEventId, msg: "stripe_event_dead_letter" });
}

// Sweeps events that no worker picked up or that died mid-run. A fresh replay key is required:
// Trigger would otherwise return the old failed run for the same key.
export async function sweepStaleStripeEvents(
  now: Date = new Date(),
): Promise<{ requeued: number }> {
  const threshold = new Date(now.getTime() - STALE_EVENT_MS);

  const stale = await prisma.billingEvent.findMany({
    orderBy: { receivedAt: "asc" },
    select: { id: true, replayCount: true, stripeEventId: true },
    take: SWEEP_BATCH_SIZE,
    where: {
      status: { in: [EVENT_STATUS.RECEIVED, EVENT_STATUS.PROCESSING] },
      updatedAt: { lt: threshold },
    },
  });

  let requeued = 0;

  for (const event of stale) {
    try {
      const runId = await tasks.trigger(
        PROCESS_STRIPE_EVENT_TASK_ID,
        { billingEventId: event.id },
        { idempotencyKey: `${event.stripeEventId}:replay:${event.replayCount + 1}` },
      );

      await prisma.billingEvent.update({
        data: {
          replayCount: { increment: 1 },
          status: EVENT_STATUS.ENQUEUED,
          triggerRunId: runId.id,
        },
        where: { id: event.id, status: { in: [EVENT_STATUS.RECEIVED, EVENT_STATUS.PROCESSING] } },
      });

      requeued += 1;
    } catch (error) {
      appLogger.error({
        error,
        msg: "stripe_event_sweep_failed",
        stripeEventId: event.stripeEventId,
      });
    }
  }

  return { requeued };
}
