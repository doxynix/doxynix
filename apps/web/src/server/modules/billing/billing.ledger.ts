import { Prisma } from "@prisma/client";

import type { DbClient } from "@/server/core/db";

export type LedgerEntryInput = {
  amount: bigint;
  billingEventId?: null | string;
  correctsEntryId?: null | string;
  currency: string;
  details?: Prisma.InputJsonValue;
  kind: string;
  occurredAt: Date;
  relatedInvoiceId?: null | string;
  relatedSubscriptionId?: null | string;
  status: string;
  stripeObjectId: string;
  workspaceId: string;
};

// Natural key: replaying the same Stripe object in the same state must not append twice.
export function ledgerEntryKey(kind: string, stripeObjectId: string, status: string): string {
  return `${kind}:${stripeObjectId}:${status}`;
}

export async function appendLedgerEntry(db: DbClient, input: LedgerEntryInput): Promise<boolean> {
  // `skipDuplicates` compiles to ON CONFLICT DO NOTHING: a replay must not abort the surrounding
  // transaction, which is what a caught unique violation does.
  const result = await db.billingLedgerEntry.createMany({
    data: [
      {
        amount: input.amount,
        billingEventId: input.billingEventId ?? null,
        correctsEntryId: input.correctsEntryId ?? null,
        currency: input.currency,
        details: input.details ?? Prisma.DbNull,
        entryKey: ledgerEntryKey(input.kind, input.stripeObjectId, input.status),
        kind: input.kind,
        occurredAt: input.occurredAt,
        relatedInvoiceId: input.relatedInvoiceId ?? null,
        relatedSubscriptionId: input.relatedSubscriptionId ?? null,
        stripeObjectId: input.stripeObjectId,
        workspaceId: input.workspaceId,
      },
    ],
    skipDuplicates: true,
  });

  return result.count > 0;
}
