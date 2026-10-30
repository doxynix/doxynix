import { createHash } from "node:crypto";

import { Prisma } from "@prisma/client";
import { tasks } from "@trigger.dev/sdk";
import type Stripe from "stripe";

import { STRIPE_LIVEMODE, STRIPE_WEBHOOK_SECRET } from "@/shared/config/env.server";

import { appLogger } from "@/server/core/app-logger";
import { prisma } from "@/server/core/db";

import { getStripeClient } from "./billing.stripe";
import type { processStripeEventTask } from "./tasks/process-stripe-event.task";

// Endpoint is subscribed to exactly these types; anything else signed is acknowledged and dropped.
const SUPPORTED_EVENT_TYPES = new Set<string>([
  "charge.dispute.closed",
  "charge.dispute.created",
  "charge.dispute.updated",
  "charge.refunded",
  "checkout.session.async_payment_failed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "customer.subscription.updated",
  "invoice.finalization_failed",
  "invoice.paid",
  "invoice.payment_failed",
  "radar.early_fraud_warning.created",
  "refund.created",
  "refund.failed",
  "refund.updated",
]);

const EVENT_STATUS = {
  ENQUEUED: "ENQUEUED",
  PROCESSED: "PROCESSED",
  RECEIVED: "RECEIVED",
} as const;

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return Response.json(body, { status });
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

// Serializes events that share a Stripe owner, so two workers never project the same subscription
// or customer at the same time. The worker refines this once it knows the workspace.
function ownershipKey(event: Stripe.Event): string {
  const object: unknown = event.data.object;

  if (typeof object === "object" && object !== null) {
    if ("customer" in object && typeof object.customer === "string") {
      return `customer:${object.customer}`;
    }

    if ("subscription" in object && typeof object.subscription === "string") {
      return `subscription:${object.subscription}`;
    }

    if ("id" in object && typeof object.id === "string") {
      return `object:${object.id}`;
    }
  }

  return `event:${event.id}`;
}

async function findExistingEvent(stripeEventId: string) {
  try {
    return await prisma.billingEvent.findUnique({
      select: { id: true, payloadHash: true, status: true },
      where: { stripeEventId },
    });
  } catch (error) {
    appLogger.error({ error, msg: "stripe_webhook_lookup_failed", stripeEventId });

    return null;
  }
}

// The event id is permanent; a different body under the same id is a replay or a forgery attempt.
async function recordHashMismatch(event: Stripe.Event): Promise<void> {
  const dedupeKey = `stripe_event_hash_mismatch:${event.id}`;

  appLogger.error({
    eventId: event.id,
    msg: "stripe_webhook_payload_hash_mismatch",
    type: event.type,
  });

  try {
    await prisma.billingIssue.upsert({
      create: {
        dedupeKey,
        details: { type: event.type },
        kind: "PAYLOAD_HASH_MISMATCH",
        severity: "CRITICAL",
        source: "stripe_webhook",
        status: "OPEN",
        stripeObjectId: event.id,
      },
      update: { lastSeenAt: new Date() },
      where: { dedupeKey },
    });
  } catch (error) {
    appLogger.error({ error, msg: "stripe_webhook_issue_write_failed", stripeEventId: event.id });
  }
}

export async function handleStripeWebhook(req: Request): Promise<Response> {
  // Raw body first: any parsing before signature verification would make the signature meaningless.
  const raw = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (signature == null || signature.trim() === "") {
    return jsonResponse({ error: "MISSING_SIGNATURE" }, 400);
  }

  let event: Stripe.Event;

  try {
    // Default tolerance on purpose: widening the window weakens replay protection.
    event = getStripeClient().webhooks.constructEvent(raw, signature, STRIPE_WEBHOOK_SECRET);
  } catch {
    return jsonResponse({ error: "INVALID_SIGNATURE" }, 400);
  }

  if (event.livemode !== STRIPE_LIVEMODE) {
    appLogger.error({
      eventId: event.id,
      msg: "stripe_webhook_livemode_mismatch",
      type: event.type,
    });

    return jsonResponse({ error: "LIVEMODE_MISMATCH" }, 400);
  }

  if (!SUPPORTED_EVENT_TYPES.has(event.type)) {
    return jsonResponse({ ignored: true }, 200);
  }

  const payloadHash = createHash("sha256").update(raw).digest("hex");

  let billingEvent: { id: string; status: string };

  try {
    billingEvent = await prisma.billingEvent.create({
      data: {
        apiVersion: event.api_version ?? null,
        livemode: event.livemode,
        payload: JSON.parse(raw) as Prisma.InputJsonValue,
        payloadHash,
        status: EVENT_STATUS.RECEIVED,
        stripeCreatedAt: new Date(event.created * 1000),
        stripeEventId: event.id,
        type: event.type,
      },
      select: { id: true, status: true },
    });
  } catch (error) {
    if (!isUniqueViolation(error)) {
      appLogger.error({ error, msg: "stripe_webhook_store_failed", stripeEventId: event.id });

      return jsonResponse({ error: "STORE_FAILED" }, 500);
    }

    const existing = await findExistingEvent(event.id);

    if (existing == null) {
      return jsonResponse({ error: "STORE_FAILED" }, 500);
    }

    if (existing.payloadHash !== payloadHash) {
      await recordHashMismatch(event);

      return jsonResponse({ error: "PAYLOAD_HASH_MISMATCH" }, 400);
    }

    if (existing.status === EVENT_STATUS.PROCESSED) {
      return jsonResponse({ duplicate: true, ok: true }, 200);
    }

    // RECEIVED/ENQUEUED/DEAD_LETTER: retry the enqueue with the same Stripe event id.
    billingEvent = { id: existing.id, status: existing.status };
  }

  try {
    const runId = await tasks.trigger<typeof processStripeEventTask>(
      "billing-process-stripe-event",
      { billingEventId: billingEvent.id },
      { concurrencyKey: ownershipKey(event), idempotencyKey: event.id },
    );

    await prisma.billingEvent.update({
      data: { status: EVENT_STATUS.ENQUEUED, triggerRunId: runId.id },
      where: { id: billingEvent.id },
    });
  } catch (error) {
    // The row stays RECEIVED, so Stripe's retry re-enqueues it instead of losing the event.
    appLogger.error({ error, msg: "stripe_webhook_enqueue_failed", stripeEventId: event.id });

    return jsonResponse({ error: "ENQUEUE_FAILED" }, 500);
  }

  return jsonResponse({ ok: true }, 200);
}
