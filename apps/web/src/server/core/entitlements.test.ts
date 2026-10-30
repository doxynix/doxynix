import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DbClient } from "@/server/core/db";
import { buildRequestStore, requestContext } from "@/server/utils/request-context";

import {
  analysisGate,
  assertAnalysisAllowed,
  assertPlanFeature,
  getWorkspaceEntitlement,
  hasPlanFeature,
  type WorkspaceEntitlementView,
} from "./entitlements";

const WORKSPACE_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d";
const NOW = new Date("2026-10-30T12:00:00.000Z");

type EntitlementRow = {
  accessState: string;
  aiTokensPerMonth: null | number;
  analysesPerMonth: null | number;
  graceEndsAt: Date | null;
  planCode: string;
  reposLimit: null | number;
  revision: bigint;
  seatLimit: number;
};

function entitlementRow(overrides: Partial<EntitlementRow> = {}): EntitlementRow {
  return {
    accessState: "ACTIVE",
    aiTokensPerMonth: 1_000_000,
    analysesPerMonth: 10,
    graceEndsAt: null,
    planCode: "PRO",
    reposLimit: null,
    revision: BigInt(3),
    seatLimit: 5,
    ...overrides,
  };
}

function createDb(
  entitlement: EntitlementRow | null,
  usage: null | { aiTokensUsed: number; analysesCount: number } = null,
) {
  return {
    workspaceEntitlement: { findUnique: vi.fn().mockResolvedValue(entitlement) },
    workspaceUsage: { findUnique: vi.fn().mockResolvedValue(usage) },
  } as unknown as DbClient;
}

function view(overrides: Partial<WorkspaceEntitlementView> = {}): WorkspaceEntitlementView {
  return {
    accessState: "ACTIVE",
    aiTokensPerMonth: 1_000_000,
    analysesPerMonth: 10,
    autoResync: true,
    graceEndsAt: null,
    hasAccess: true,
    planCode: "PRO",
    privateReposAllowed: true,
    prReviews: true,
    reposLimit: null,
    revision: BigInt(3),
    seatLimit: 5,
    usedAnalyses: 0,
    usedTokens: 0,
    ...overrides,
  };
}

describe("getWorkspaceEntitlement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the projection with the used counters", async () => {
    const db = createDb(entitlementRow(), { aiTokensUsed: 1200, analysesCount: 4 });

    const result = await getWorkspaceEntitlement(db, WORKSPACE_ID, NOW);

    expect(result).toMatchObject({
      accessState: "ACTIVE",
      hasAccess: true,
      planCode: "PRO",
      seatLimit: 5,
      usedAnalyses: 4,
      usedTokens: 1200,
    });
  });

  it("reads negative counters as zero", async () => {
    const db = createDb(entitlementRow(), { aiTokensUsed: -50, analysesCount: -2 });

    const result = await getWorkspaceEntitlement(db, WORKSPACE_ID, NOW);

    expect(result?.usedAnalyses).toBe(0);
    expect(result?.usedTokens).toBe(0);
  });

  it("does not cache between requests", async () => {
    const db = createDb(entitlementRow());

    await getWorkspaceEntitlement(db, WORKSPACE_ID, NOW);
    await getWorkspaceEntitlement(db, WORKSPACE_ID, NOW);

    expect(db.workspaceEntitlement.findUnique).toHaveBeenCalledTimes(2);
  });

  it("memoizes one read inside a single request store", async () => {
    const db = createDb(entitlementRow());
    const store = buildRequestStore({
      method: "POST",
      path: "/api/trpc",
      req: new Request("http://localhost/api/trpc"),
    });

    const [first, second] = await requestContext.run(store, async () => {
      return Promise.all([
        getWorkspaceEntitlement(db, WORKSPACE_ID, NOW),
        getWorkspaceEntitlement(db, WORKSPACE_ID, NOW),
      ]);
    });

    expect(first).toBe(second);
    expect(db.workspaceEntitlement.findUnique).toHaveBeenCalledTimes(1);
  });

  it("returns null when the workspace has no entitlement row", async () => {
    const db = createDb(null);

    await expect(getWorkspaceEntitlement(db, WORKSPACE_ID, NOW)).resolves.toBeNull();
  });
});

describe("analysisGate", () => {
  it.each(["ACTIVE", "GRACE"] as const)("allows %s", (accessState) => {
    const gate = analysisGate(
      view({
        accessState,
        graceEndsAt: accessState === "GRACE" ? new Date("2026-11-05T00:00:00.000Z") : null,
        hasAccess: true,
      }),
    );

    expect(gate).toEqual({ allowed: true, reason: null });
  });

  it.each(["PENDING", "REVIEW", "SUSPENDED", "CANCELED", "NO_SUBSCRIPTION"] as const)(
    "requires payment for %s",
    (accessState) => {
      const gate = analysisGate(view({ accessState, hasAccess: false }));

      expect(gate).toEqual({ allowed: false, reason: "PAYMENT_REQUIRED" });
    },
  );

  it("rejects an expired grace even if the state still says GRACE", () => {
    const gate = analysisGate(view({ accessState: "GRACE", hasAccess: false }));

    expect(gate.reason).toBe("PAYMENT_REQUIRED");
  });

  it("rejects the analysis quota at the boundary", () => {
    expect(analysisGate(view({ usedAnalyses: 10 })).reason).toBe("LIMIT_EXCEEDED");
    expect(analysisGate(view({ usedAnalyses: 9 })).allowed).toBe(true);
  });

  it("rejects the token quota at the boundary", () => {
    expect(analysisGate(view({ usedTokens: 1_000_000 })).reason).toBe("LIMIT_EXCEEDED");
  });

  it("treats an unlimited quota as no limit", () => {
    const gate = analysisGate(
      view({ aiTokensPerMonth: null, analysesPerMonth: null, usedAnalyses: 999_999 }),
    );

    expect(gate.allowed).toBe(true);
  });

  it("treats a missing entitlement as payment required", () => {
    expect(analysisGate(null)).toEqual({ allowed: false, reason: "PAYMENT_REQUIRED" });
  });
});

function thrownBy(run: () => void): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }

  return null;
}

describe("assertAnalysisAllowed", () => {
  it("throws PAYMENT_REQUIRED without access", () => {
    const error = thrownBy(() => assertAnalysisAllowed(view({ hasAccess: false })));

    expect(error).toMatchObject({ code: "PAYMENT_REQUIRED" });
  });

  it("throws LIMIT_EXCEEDED at the quota boundary", () => {
    const error = thrownBy(() => assertAnalysisAllowed(view({ usedAnalyses: 10 })));

    expect(error).toMatchObject({ code: "FORBIDDEN", publicMessage: "LIMIT_EXCEEDED" });
  });

  it("passes for an allowed workspace", () => {
    expect(thrownBy(() => assertAnalysisAllowed(view()))).toBeNull();
  });
});

describe("plan features", () => {
  it.each(["autoResync", "prReviews", "privateReposAllowed"] as const)(
    "rejects %s when the plan does not include it",
    (feature) => {
      const error = thrownBy(() => assertPlanFeature(view({ [feature]: false }), feature));

      expect(error).toMatchObject({ code: "FORBIDDEN", publicMessage: "FEATURE_NOT_IN_PLAN" });
    },
  );

  it("rejects every feature without an entitlement", () => {
    expect(hasPlanFeature(null, "privateReposAllowed")).toBe(false);
    expect(thrownBy(() => assertPlanFeature(null, "prReviews"))).toMatchObject({
      publicMessage: "FEATURE_NOT_IN_PLAN",
    });
  });

  it("passes for an included feature", () => {
    expect(thrownBy(() => assertPlanFeature(view(), "autoResync"))).toBeNull();
  });
});
