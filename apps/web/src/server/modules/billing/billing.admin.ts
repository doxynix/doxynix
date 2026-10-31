import type { BillingIssueSeverity, BillingIssueStatus } from "@doxynix/shared";
import { tasks } from "@trigger.dev/sdk";
import { TRPCError } from "@trpc/server";

import { appLogger } from "@/server/core/app-logger";
import { recordBillingMetric } from "@/server/core/billing/metrics";
import { getStripeClient } from "@/server/core/billing/stripe-client";
import type { DbClient } from "@/server/core/db";

import { PROCESS_STRIPE_EVENT_TASK_ID } from "./billing.constants";
import { ownershipKeyFromPayload } from "./billing.ownership";
import { projectSubscription } from "./billing.subscriptions";
import type { processStripeEventTask } from "./tasks/process-stripe-event.task";

const REPLAYABLE_STATUSES = new Set(["DEAD_LETTER", "ENQUEUED", "RECEIVED"]);
const LIST_LIMIT = 50;

export type BillingIssueSummary = {
  details: unknown;
  firstSeenAt: Date;
  id: string;
  kind: string;
  lastSeenAt: Date;
  resolvedAt: Date | null;
  severity: string;
  source: string;
  status: string;
  externalObjectId: null | string;
  workspaceId: null | string;
};

export async function replayBillingEvent(
  db: DbClient,
  input: { actorUserId: string; billingEventId: string },
): Promise<{ runId: string }> {
  const event = await db.billingEvent.findUnique({
    select: {
      externalEventId: true,
      payload: true,
      replayCount: true,
      status: true,
    },
    where: { id: input.billingEventId },
  });

  if (event == null) {
    throw new TRPCError({ code: "NOT_FOUND", message: "BILLING_EVENT_NOT_FOUND" });
  }

  if (event.status === "PROCESSED") {
    throw new TRPCError({ code: "CONFLICT", message: "BILLING_EVENT_ALREADY_PROCESSED" });
  }

  if (!REPLAYABLE_STATUSES.has(event.status)) {
    throw new TRPCError({ code: "CONFLICT", message: "BILLING_EVENT_NOT_REPLAYABLE" });
  }

  // The suffix is mandatory: Trigger remembers the original key for 30 days and would hand back
  // the failed run instead of starting a new one.
  const run = await tasks.trigger<typeof processStripeEventTask>(
    PROCESS_STRIPE_EVENT_TASK_ID,
    { billingEventId: input.billingEventId },
    {
      concurrencyKey: ownershipKeyFromPayload(event.payload),
      idempotencyKey: `${event.externalEventId}:replay:${event.replayCount + 1}`,
    },
  );

  await db.billingEvent.update({
    data: {
      replayCount: { increment: 1 },
      status: "ENQUEUED",
      triggerRunId: run.id,
    },
    where: { id: input.billingEventId },
  });

  recordBillingMetric("billing_replay_total", 1, {});

  // Billing models are not in the audited set, so the operator action is recorded structurally
  // here; a schema-backed audit row is tracked as a follow-up.
  appLogger.info({
    actorUserId: input.actorUserId,
    billingEventId: input.billingEventId,
    msg: "billing.event_replayed",
    runId: run.id,
    type: "billing.audit",
  });

  return { runId: run.id };
}

const URL_IN_TEXT = /https?:\/\/\S+/gi;
const EMAIL_IN_TEXT = /[^\s@]+@[^\s@]+\.[^\s@]+/g;

// The note is operator free text, so strip links and addresses before it reaches JSONB.
function sanitizeNote(note: string): string {
  return note.replace(URL_IN_TEXT, "[redacted]").replace(EMAIL_IN_TEXT, "[redacted]");
}

function mergeResolutionNote(details: unknown, note: string): Record<string, unknown> {
  const resolutionNote = sanitizeNote(note);
  const base =
    typeof details === "object" && details != null && !Array.isArray(details)
      ? (details as Record<string, unknown>)
      : {};

  return { ...base, resolutionNote };
}

export async function resolveBillingIssue(
  db: DbClient,
  input: { actorUserId: string; issueId: string; note?: string },
): Promise<{ resolved: boolean }> {
  const issue = await db.billingIssue.findUnique({
    select: {
      details: true,
      externalObjectId: true,
      kind: true,
      status: true,
      workspaceId: true,
    },
    where: { id: input.issueId },
  });

  if (issue == null) {
    throw new TRPCError({ code: "NOT_FOUND", message: "BILLING_ISSUE_NOT_FOUND" });
  }

  if (issue.status === "RESOLVED") {
    return { resolved: false };
  }

  const details =
    input.note == null
      ? (issue.details as Record<string, unknown> | null)
      : mergeResolutionNote(issue.details, input.note);

  await db.billingIssue.update({
    data: {
      details: details ?? undefined,
      resolvedAt: new Date(),
      status: "RESOLVED",
    },
    where: { id: input.issueId },
  });

  // Clearing the review flag is not enough: the entitlement is still REVIEW, and reconciliation
  // only repairs rows that differ. Recompute the projection from the canonical subscription here.
  if (
    issue.kind === "SUBSCRIPTION_REVIEW" &&
    issue.externalObjectId != null &&
    issue.workspaceId != null
  ) {
    await db.billingSubscription.updateMany({
      data: { needsReview: false, reviewReason: null },
      where: { externalSubscriptionId: issue.externalObjectId },
    });

    try {
      const customer = await db.billingCustomer.findFirst({
        select: { externalCustomerId: true, id: true },
        where: { provider: "stripe", workspaceId: issue.workspaceId },
      });

      if (customer != null) {
        const subscription = await getStripeClient().subscriptions.retrieve(
          issue.externalObjectId,
          { expand: ["latest_invoice"] },
        );

        await projectSubscription(db, {
          now: new Date(),
          ownership: {
            billingCustomerId: customer.id,
            customerId: customer.externalCustomerId,
            workspaceId: issue.workspaceId,
          },
          subscription,
        });
      }
    } catch (error) {
      appLogger.error({ error, msg: "billing.review_projection_failed" });
    }
  }

  appLogger.info({
    actorUserId: input.actorUserId,
    issueId: input.issueId,
    msg: "billing.issue_resolved",
    type: "billing.audit",
  });

  return { resolved: true };
}

export async function listBillingIssues(
  db: DbClient,
  input: {
    cursor?: string;
    severity?: BillingIssueSeverity;
    status?: BillingIssueStatus;
  },
): Promise<{ items: Array<BillingIssueSummary>; nextCursor: null | string }> {
  const items = await db.billingIssue.findMany({
    orderBy: [{ lastSeenAt: "desc" }, { id: "desc" }],
    take: LIST_LIMIT + 1,
    ...(input.cursor == null ? {} : { cursor: { id: input.cursor }, skip: 1 }),
    where: {
      ...(input.severity == null ? {} : { severity: input.severity }),
      ...(input.status == null ? {} : { status: input.status }),
    },
  });

  const hasMore = items.length > LIST_LIMIT;
  const page = hasMore ? items.slice(0, LIST_LIMIT) : items;

  return {
    items: page,
    nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
  };
}
