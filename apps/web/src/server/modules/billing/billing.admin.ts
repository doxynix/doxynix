import { tasks } from "@trigger.dev/sdk";
import { TRPCError } from "@trpc/server";

import { recordBillingMetric } from "@/server/core/billing/metrics";
import type { DbClient } from "@/server/core/db";

import { PROCESS_STRIPE_EVENT_TASK_ID } from "./billing.constants";
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
  stripeObjectId: null | string;
  workspaceId: null | string;
};

export async function replayBillingEvent(
  db: DbClient,
  input: { billingEventId: string },
): Promise<{ runId: string }> {
  const event = await db.billingEvent.findUnique({
    select: { replayCount: true, status: true, stripeEventId: true },
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
    { idempotencyKey: `${event.stripeEventId}:replay:${event.replayCount + 1}` },
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
  input: { issueId: string; note?: string },
): Promise<{ resolved: boolean }> {
  const issue = await db.billingIssue.findUnique({
    select: { details: true, status: true },
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

  return { resolved: true };
}

export async function listBillingIssues(
  db: DbClient,
  input: { cursor?: string; severity?: string; status?: string },
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
