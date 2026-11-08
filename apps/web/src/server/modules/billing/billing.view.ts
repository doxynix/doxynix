import { PlanCode, PlanCodeSchema } from "@doxynix/shared";
import { getBillingUsageDays } from "@prisma/client/sql";

import type { DbClient } from "@/server/core/db";
import { getWorkspaceEntitlement } from "@/server/core/entitlements";
import { periodStartOf } from "@/server/core/usage/usage";

import type { BillingState } from "./billing.schemas";

function periodEndOf(periodStart: Date): Date {
  return new Date(Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() + 1, 1));
}

// The daily series is derived from the append-only meter, not from the monthly rollup: the rollup
// only knows "how much so far" and cannot be replayed onto a chart.
async function loadUsageDays(
  db: DbClient,
  workspaceId: string,
  periodStart: Date,
  periodEnd: Date,
) {
  const rows = await db.$queryRawTyped(getBillingUsageDays(workspaceId, periodStart, periodEnd));

  return rows.map((row) => ({
    analyses: row.analyses ?? 0,
    date: row.date ?? "",
    tokens: row.tokens ?? 0,
  }));
}

// The settings screen is read-only on render: entitlement, current subscription and member count
// come from the DB projection, never from a Stripe call.
export async function getBillingState(db: DbClient, workspaceId: string): Promise<BillingState> {
  const now = new Date();
  const periodStart = periodStartOf(now);
  const periodEnd = periodEndOf(periodStart);

  const [entitlement, subscription, activeMembers, usageDays] = await Promise.all([
    getWorkspaceEntitlement(db, workspaceId, now),
    db.billingSubscription.findFirst({
      select: {
        cancelAtPeriodEnd: true,
        currentPeriodEnd: true,
        externalStatus: true,
        quantity: true,
      },
      where: { isCurrent: true, workspaceId },
    }),
    db.workspaceMember.count({ where: { workspaceId } }),
    loadUsageDays(db, workspaceId, periodStart, periodEnd),
  ]);

  const parsedPlan = entitlement == null ? null : PlanCodeSchema.safeParse(entitlement.planCode);

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
            // Fail closed to HOBBY: an unknown plan is already REVIEW in the access state.
            planCode: parsedPlan?.success === true ? parsedPlan.data : PlanCode.HOBBY,
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
            status: subscription.externalStatus,
          },
    usage: { days: usageDays, now, periodEnd, periodStart },
  };
}
