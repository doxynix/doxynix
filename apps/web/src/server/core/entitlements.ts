import { AppError } from "@/server/core/api-error";
import type { DbClient } from "@/server/core/db";
import { periodStartOf } from "@/server/core/usage/usage";
import { requestContext } from "@/server/utils/request-context";

import { type AccessState, isAccessState } from "./entitlements/state";

export type WorkspaceEntitlementView = {
  accessState: AccessState;
  aiTokensPerMonth: null | number;
  analysesPerMonth: null | number;
  graceEndsAt: Date | null;
  hasAccess: boolean;
  planCode: string;
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
    graceEndsAt: entitlement.graceEndsAt,
    hasAccess: accessState === "ACTIVE" || graceActive,
    planCode: entitlement.planCode,
    reposLimit: entitlement.reposLimit,
    revision: entitlement.revision,
    seatLimit: entitlement.seatLimit,
    usedAnalyses: Math.max(0, usage?.analysesCount ?? 0),
    usedTokens: Math.max(0, usage?.aiTokensUsed ?? 0),
  };
}

// DB-only read model. The memo lives in the request store, so a batched tRPC call reads the
// workspace once; there is no cross-request cache and therefore no revocation staleness.
export async function getWorkspaceEntitlement(
  db: DbClient,
  workspaceId: string,
  now: Date = new Date(),
): Promise<null | WorkspaceEntitlementView> {
  const memo = requestContext.getStore()?.entitlementMemo;

  if (memo == null) {
    return loadEntitlement(db, workspaceId, now);
  }

  const key = `${workspaceId}:${periodStartOf(now).toISOString()}`;
  const cached = memo.get(key);

  if (cached != null) {
    return cached as Promise<null | WorkspaceEntitlementView>;
  }

  const pending = loadEntitlement(db, workspaceId, now);
  memo.set(key, pending);

  return pending;
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
    throw new AppError({ code: "PAYMENT_REQUIRED", publicMessage: "PAYMENT_REQUIRED" });
  }

  if (gate.reason === "LIMIT_EXCEEDED") {
    throw new AppError({ code: "FORBIDDEN", publicMessage: "LIMIT_EXCEEDED" });
  }
}
