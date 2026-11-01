import type { DbClient } from "@/server/core/db";

import { getStripeClient } from "./stripe-client";

export type SeatAdditionPreview = {
  // Cents per seat and month; null when Stripe reports no amount or there is nothing to bill.
  amountPerSeatCents: null | number;
  currency: null | string;
  // True only when adding one member goes past the paid quantity of a live subscription.
  needsCharge: boolean;
  periodEnd: Date | null;
  quantity: number;
};

// The members screen asks this before saving a person: a seat is a paid resource, so the owner must
// see the price before the prorated invoice is charged. Read-only and one Stripe call; the amount
// is the list price, not a total, because today's charge depends on the remainder of the period.
export async function previewSeatAddition(input: {
  db: DbClient;
  workspaceId: string;
}): Promise<SeatAdditionPreview> {
  const [subscription, members] = await Promise.all([
    input.db.billingSubscription.findFirst({
      select: { externalStatus: true, externalSubscriptionId: true, quantity: true },
      where: { isCurrent: true, workspaceId: input.workspaceId },
    }),
    input.db.workspaceMember.count({ where: { workspaceId: input.workspaceId } }),
  ]);

  // After the save the sync bills this quantity (`max(1, members)` in `seat-sync`).
  const quantity = members + 1;
  const empty: SeatAdditionPreview = {
    amountPerSeatCents: null,
    currency: null,
    needsCharge: false,
    periodEnd: null,
    quantity,
  };

  if (subscription == null) {
    return empty;
  }

  // Seat sync leaves a delinquent subscription alone, and the members screen refuses to add anyone
  // without ACTIVE access, so nothing is billed in those states.
  if (subscription.externalStatus !== "active" || quantity <= subscription.quantity) {
    return empty;
  }

  const remote = await getStripeClient().subscriptions.retrieve(
    subscription.externalSubscriptionId,
  );
  const item = remote.items.data[0];

  return {
    amountPerSeatCents: item?.price.unit_amount ?? null,
    currency: item?.price.currency ?? null,
    needsCharge: true,
    periodEnd: item == null ? null : new Date(item.current_period_end * 1000),
    quantity,
  };
}
