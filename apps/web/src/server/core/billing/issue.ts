import { Prisma } from "@prisma/client";

import type { DbClient } from "@/server/core/db";

export type BillingIssueInput = {
  dedupeKey: string;
  details?: Prisma.InputJsonValue;
  kind: string;
  severity: "CRITICAL" | "INFO" | "WARNING";
  source: string;
  stripeObjectId?: null | string;
  workspaceId?: null | string;
};

// Issues are deduplicated by key, so a repeated webhook bumps `lastSeenAt` instead of flooding.
export async function upsertBillingIssue(db: DbClient, input: BillingIssueInput): Promise<void> {
  const now = new Date();

  await db.billingIssue.upsert({
    create: {
      dedupeKey: input.dedupeKey,
      details: input.details ?? Prisma.DbNull,
      firstSeenAt: now,
      kind: input.kind,
      lastSeenAt: now,
      severity: input.severity,
      source: input.source,
      status: "OPEN",
      stripeObjectId: input.stripeObjectId ?? null,
      workspaceId: input.workspaceId ?? null,
    },
    update: { lastSeenAt: now },
    where: { dedupeKey: input.dedupeKey },
  });
}
