import { type AccessState, MessageCode } from "@doxynix/shared";

import { AppError } from "@/server/core/api-error";
import type { DbClient } from "@/server/core/db";
import { periodStartOf } from "@/server/core/usage/usage";
import { requestContext } from "@/server/utils/request-context";
import { memoizeOnce } from "@/server/utils/request-memo";

import { isAccessState } from "./entitlements/state";

export type PlanFeature = "autoResync" | "prReviews" | "privateReposAllowed";

export type WorkspaceEntitlementView = {
  accessState: AccessState;
  aiTokensPerMonth: null | number;
  analysesPerMonth: null | number;
  autoResync: boolean;
  graceEndsAt: Date | null;
  hasAccess: boolean;
  planCode: string;
  prReviews: boolean;
  privateReposAllowed: boolean;
  reposLimit: null | number;
  revision: bigint;
  seatLimit: number;
  usedAnalyses: number;
  usedTokens: number;
};

export type AnalysisGate = {
  allowed: boolean;
  reason: null | "LIMIT_EXCEEDED" | "PAYMENT_REQUIRED";
};

async function loadEntitlement(
  db: DbClient,
  workspaceId: string,
  now: Date,
): Promise<null | WorkspaceEntitlementView> {
  const periodStart = periodStartOf(now);

  const [entitlement, usage] = await Promise.all([
    db.workspaceEntitlement.findUnique({ where: { workspaceId } }),
    db.workspaceUsage.findUnique({
      where: { workspaceId_periodStart: { periodStart, workspaceId } },
    }),
  ]);

  if (entitlement == null) {
    return null;
  }

  const accessState = isAccessState(entitlement.accessState) ? entitlement.accessState : "REVIEW";
  // GRACE without a live deadline is not access: the same fail-closed rule as the state machine.
  const graceActive =
    accessState === "GRACE" &&
    entitlement.graceEndsAt != null &&
    entitlement.graceEndsAt.getTime() > now.getTime();

  return {
    accessState,
    aiTokensPerMonth: entitlement.aiTokensPerMonth,
    analysesPerMonth: entitlement.analysesPerMonth,
    autoResync: entitlement.autoResync,
    graceEndsAt: entitlement.graceEndsAt,
    hasAccess: accessState === "ACTIVE" || graceActive,
    planCode: entitlement.planCode,
    privateReposAllowed: entitlement.privateReposAllowed,
    prReviews: entitlement.prReviews,
    reposLimit: entitlement.reposLimit,
    revision: entitlement.revision,
    seatLimit: entitlement.seatLimit,
    usedAnalyses: Math.max(0, usage?.analysesCount ?? 0),
    usedTokens: Math.max(0, usage?.aiTokensUsed ?? 0),
  };
}

// DB-only read model. The memo lives in the request store, so a batched tRPC call reads the
// workspace once; there is no cross-request cache and therefore no revocation staleness.
// `fresh` bypasses the memo for callers that must see the value after taking a lock.
export async function getWorkspaceEntitlement(
  db: DbClient,
  workspaceId: string,
  now: Date = new Date(),
  options: { fresh?: boolean } = {},
): Promise<null | WorkspaceEntitlementView> {
  if (options.fresh === true) {
    return loadEntitlement(db, workspaceId, now);
  }

  // `now` is not a key part: only the quota period it falls in changes the result, and using the
  // timestamp would make every call in one request a miss.
  return memoizeOnce(
    requestContext.getStore()?.entitlementMemo,
    "entitlement",
    [workspaceId, periodStartOf(now).toISOString()],
    () => loadEntitlement(db, workspaceId, now),
  );
}

export function analysisGate(entitlement: null | WorkspaceEntitlementView): AnalysisGate {
  if (entitlement == null || !entitlement.hasAccess) {
    return { allowed: false, reason: "PAYMENT_REQUIRED" };
  }

  if (
    entitlement.analysesPerMonth != null &&
    entitlement.usedAnalyses >= entitlement.analysesPerMonth
  ) {
    return { allowed: false, reason: "LIMIT_EXCEEDED" };
  }

  // Token quota is a safety valve: the analysis would overshoot the plan long before it finishes.
  if (
    entitlement.aiTokensPerMonth != null &&
    entitlement.usedTokens >= entitlement.aiTokensPerMonth
  ) {
    return { allowed: false, reason: "LIMIT_EXCEEDED" };
  }

  return { allowed: true, reason: null };
}

export function assertAnalysisAllowed(entitlement: null | WorkspaceEntitlementView): void {
  const gate = analysisGate(entitlement);

  if (gate.reason === "PAYMENT_REQUIRED") {
    throw new AppError({
      code: "PAYMENT_REQUIRED",
      messageCode: MessageCode.PAYMENT_REQUIRED,
      publicMessage: "PAYMENT_REQUIRED",
    });
  }

  if (gate.reason === "LIMIT_EXCEEDED") {
    throw new AppError({
      code: "FORBIDDEN",
      messageCode: MessageCode.AI_LIMIT_EXCEEDED,
      publicMessage: "LIMIT_EXCEEDED",
    });
  }
}

// One place for the paywall flags: a suspended or unpaid workspace must not get a paid feature
// just because the plan row still says PRO.
export function assertPlanFeature(
  entitlement: null | WorkspaceEntitlementView,
  feature: PlanFeature,
): void {
  if (entitlement == null || !entitlement.hasAccess || !entitlement[feature]) {
    throw new AppError({
      code: "FORBIDDEN",
      messageCode: MessageCode.FEATURE_NOT_IN_PLAN,
      publicMessage: "FEATURE_NOT_IN_PLAN",
    });
  }
}

export function hasPlanFeature(
  entitlement: null | WorkspaceEntitlementView,
  feature: PlanFeature,
): boolean {
  return entitlement != null && entitlement.hasAccess && entitlement[feature];
}
