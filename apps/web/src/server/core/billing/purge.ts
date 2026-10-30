import { Prisma } from "@prisma/client";

import type { DbClient } from "@/server/core/db";

export const BILLING_PAYLOAD_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

// The raw payload is the only PII-bearing part of an event. It is dropped after 90 days; the row
// and its unique stripeEventId stay forever, because deduplication depends on them.
export async function purgeBillingEventPayloads(
  db: DbClient,
  now: Date = new Date(),
): Promise<number> {
  const cutoff = new Date(now.getTime() - BILLING_PAYLOAD_RETENTION_MS);

  const result = await db.billingEvent.updateMany({
    data: { payload: Prisma.DbNull },
    where: { payload: { not: Prisma.DbNull }, receivedAt: { lt: cutoff } },
  });

  return result.count;
}
