import type { DbClient } from "@/server/core/db";
import { getWorkspaceEntitlement } from "@/server/core/entitlements";

import type { BillingState } from "./billing.schemas";

// The settings screen is read-only on render: entitlement, current subscription and member count
// come from the DB projection, never from a Stripe call.
export async function getBillingState(db: DbClient, workspaceId: string): Promise<BillingState> {
  const [entitlement, subscription, activeMembers] = await Promise.all([
    getWorkspaceEntitlement(db, workspaceId),
    db.billingSubscription.findFirst({
      select: {
        cancelAtPeriodEnd: true,
        currentPeriodEnd: true,
        quantity: true,
        stripeStatus: true,
      },
      where: { isCurrent: true, workspaceId },
    }),
    db.workspaceMember.count({ where: { workspaceId } }),
  ]);

  return {
    activeMembers,
    entitlement:
      entitlement == null
        ? null
        : {
            accessState: entitlement.accessState,
            aiTokensPerMonth: entitlement.aiTokensPerMonth,
            analysesPerMonth: entitlement.analysesPerMonth,
            graceEndsAt: entitlement.graceEndsAt,
            planCode: entitlement.planCode,
            seatLimit: entitlement.seatLimit,
            usedAnalyses: entitlement.usedAnalyses,
            usedTokens: entitlement.usedTokens,
          },
    subscription:
      subscription == null
        ? null
        : {
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            currentPeriodEnd: subscription.currentPeriodEnd,
            quantity: subscription.quantity,
            status: subscription.stripeStatus,
          },
  };
}
