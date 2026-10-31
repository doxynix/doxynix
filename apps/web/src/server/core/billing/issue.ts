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

  // Same reason as the ledger: ON CONFLICT DO NOTHING cannot abort the caller's transaction.
  await db.billingIssue.createMany({
    data: [
      {
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
    ],
    skipDuplicates: true,
  });

  await db.billingIssue.updateMany({
    data: { lastSeenAt: now },
    where: { dedupeKey: input.dedupeKey },
  });
}
