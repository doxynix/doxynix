import type { Prisma } from "@prisma/client";
import { markBillingEventsEnqueued } from "@prisma/client/sql";
import { tasks } from "@trigger.dev/sdk";
import type Stripe from "stripe";

import { appLogger } from "@/server/core/app-logger";
import { upsertBillingIssue } from "@/server/core/billing/issue";
import { captureBillingAlert, recordBillingMetric } from "@/server/core/billing/metrics";
import { STRIPE_API_VERSION } from "@/server/core/billing/stripe-version";
import { type DbClient, prisma } from "@/server/core/db";

import { PROCESS_STRIPE_EVENT_TASK_ID } from "./billing.constants";
import { NonRetryableBillingError } from "./billing.errors";
import { applyInvoiceEvent, retrieveSubscriptionForInvoice } from "./billing.invoices";
import { ownershipKeyFromPayload } from "./billing.ownership";
import {
  type BillingOwnership,
  type CanonicalStripeObject,
  resolveCanonicalObject,
  resolveOwnership,
  type StoredStripeEvent,
} from "./billing.resolver";
import { applyRiskEvent, isRiskObject, resolveRiskLinks } from "./billing.risk";
import { fromStripeSubscription } from "./billing.snapshot";
import { projectSubscription } from "./billing.subscriptions";

const STALE_EVENT_MS = 15 * 60 * 1000;
// An ENQUEUED event whose run was lost (deploy, concurrency stall) needs a longer grace than a
// PROCESSING one, but it must not sit forever.
const STALE_ENQUEUED_MS = 30 * 60 * 1000;
const SWEEP_BATCH_SIZE = 50;
const SWEEP_CONCURRENCY = 10;

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
    data: { lastError: null, processedAt: new Date(), status: "PROCESSED" },
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
    where: { externalSubscriptionId: canonical.subscription.id },
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
      externalObjectId: event.data.object.id,
      kind: "UNOWNED_STRIPE_OBJECT",
      severity: "CRITICAL",
      source: "worker",
      workspaceId: knownWorkspaceId,
    });

    await markProcessed(tx, billingEventId);
  });

  captureBillingAlert("UNOWNED_STRIPE_OBJECT", { externalObjectId: event.data.object.id });

  appLogger.error({
    billingEventId,
    externalObjectId: event.data.object.id,
    msg: "stripe_event_unowned_object",
    type: event.type,
  });
}

async function assertOwnerMatches(
  subscription: Stripe.Subscription,
  workspaceId: string,
): Promise<void> {
  const existing = await prisma.billingSubscription.findUnique({
    select: { workspaceId: true },
    where: { externalSubscriptionId: subscription.id },
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
  const externalStatus = checkoutSessionStatus(eventType, session);

  await tx.billingCheckoutSession.upsert({
    create: {
      externalCheckoutSessionId: session.id,
      externalCustomerId: ownership.customerId ?? idOf(session.customer) ?? "",
      externalStatus,
      workspaceId: ownership.workspaceId,
    },
    update: { externalStatus },
    where: { externalCheckoutSessionId: session.id },
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

  if (stored.status === "PROCESSED") {
    return { status: "skipped" };
  }

  await prisma.billingEvent.update({
    data: { attempts: { increment: 1 }, status: "PROCESSING" },
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
        snapshot: fromStripeSubscription(canonical.subscription),
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
    select: { externalEventId: true, type: true },
    where: { id: billingEventId },
  });
  const message = error instanceof Error ? error.message.slice(0, 500) : "UNKNOWN_ERROR";

  await prisma.$transaction(async (tx) => {
    await tx.billingEvent.update({
      data: { lastError: message, status: "DEAD_LETTER" },
      where: { id: billingEventId },
    });

    await upsertBillingIssue(tx, {
      dedupeKey: `dead_letter:${stored?.externalEventId ?? billingEventId}`,
      details: { type: stored?.type ?? "unknown" },
      externalObjectId: stored?.externalEventId ?? null,
      kind: "EVENT_DEAD_LETTER",
      severity: "CRITICAL",
      source: "worker",
    });
  });

  recordBillingMetric("billing_dlq_total", 1, {});
  recordBillingMetric("billing_event_failures_total", 1, {});
  captureBillingAlert("DLQ", { billingEventId });

  appLogger.error({ billingEventId, msg: "stripe_event_dead_letter" });
}

function triggerReplay(event: {
  externalEventId: string;
  id: string;
  payload: unknown;
  replayCount: number;
}): Promise<string> {
  return tasks
    .trigger(
      PROCESS_STRIPE_EVENT_TASK_ID,
      { billingEventId: event.id },
      {
        concurrencyKey: ownershipKeyFromPayload(event.payload),
        idempotencyKey: `${event.externalEventId}:replay:${event.replayCount + 1}`,
      },
    )
    .then((run) => run.id);
}

// Sweeps events that no worker picked up or that died mid-run. A fresh replay key is required:
// Trigger would otherwise return the old failed run for the same key.
export async function sweepStaleStripeEvents(
  now: Date = new Date(),
): Promise<{ requeued: number }> {
  const processingThreshold = new Date(now.getTime() - STALE_EVENT_MS);
  const enqueuedThreshold = new Date(now.getTime() - STALE_ENQUEUED_MS);

  const stale = await prisma.billingEvent.findMany({
    orderBy: { receivedAt: "asc" },
    select: {
      externalEventId: true,
      id: true,
      payload: true,
      replayCount: true,
      updatedAt: true,
    },
    take: SWEEP_BATCH_SIZE,
    where: {
      OR: [
        {
          status: { in: ["RECEIVED", "PROCESSING"] },
          updatedAt: { lt: processingThreshold },
        },
        { status: "ENQUEUED", updatedAt: { lt: enqueuedThreshold } },
      ],
    },
  });

  if (stale.length === 0) {
    return { requeued: 0 };
  }

  // Run ids stay per-row. Chunked so a full batch does not burst 50 trigger requests at once.
  const runs: Array<PromiseSettledResult<string>> = [];

  for (let index = 0; index < stale.length; index += SWEEP_CONCURRENCY) {
    const chunk = stale.slice(index, index + SWEEP_CONCURRENCY);

    runs.push(...(await Promise.allSettled(chunk.map(triggerReplay))));
  }

  const queued: Array<{ expectedUpdatedAt: string; id: string; runId: string }> = [];

  for (const [index, event] of stale.entries()) {
    const run = runs[index];

    if (run == null) {
      continue;
    }

    if (run.status === "rejected") {
      appLogger.error({
        error: run.reason,
        externalEventId: event.externalEventId,
        msg: "stripe_event_sweep_failed",
      });

      continue;
    }

    queued.push({
      expectedUpdatedAt: event.updatedAt.toISOString(),
      id: event.id,
      runId: run.value,
    });
  }

  if (queued.length === 0) {
    return { requeued: 0 };
  }

  const updated = await prisma.$queryRawTyped(
    markBillingEventsEnqueued({
      items: queued.map(({ expectedUpdatedAt, id, runId }) => ({
        expected_updated_at: expectedUpdatedAt,
        id,
        run_id: runId,
      })),
    }),
  );

  if (updated.length < queued.length) {
    // The status/freshness guard skipped a row: a worker picked it up between the select and here.
    appLogger.warn({
      msg: "stripe_event_sweep_skipped",
      queued: queued.length,
      updated: updated.length,
    });
  }

  return { requeued: updated.length };
}
