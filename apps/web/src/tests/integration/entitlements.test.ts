import { enhance } from "@zenstackhq/runtime";
import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/core/db";
import {
  analysisGate,
  getWorkspaceEntitlement,
  type WorkspaceEntitlementView,
} from "@/server/core/entitlements";
import {
  periodStartOf,
  recordAnalysisUsage,
  releaseAnalysisUsage,
} from "@/server/core/usage/usage";

import { cleanupDatabase, createBareTestUser, createTestUser } from "../helpers";

function gateReason(entitlement: null | WorkspaceEntitlementView) {
  return analysisGate(entitlement).reason;
}

describe("workspace entitlement reader", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  it("reads the projection and the used counters from the database", async () => {
    const alice = await createTestUser("Alice");

    await prisma.workspaceEntitlement.update({
      data: { analysesPerMonth: 3 },
      where: { workspaceId: alice.workspace.id },
    });
    await recordAnalysisUsage(prisma, {
      analysisId: null,
      idempotencyKey: "analysis:first",
      workspaceId: alice.workspace.id,
    });

    const entitlement = await getWorkspaceEntitlement(prisma, alice.workspace.id);

    expect(entitlement).toMatchObject({
      accessState: "ACTIVE",
      analysesPerMonth: 3,
      hasAccess: true,
      planCode: "HOBBY",
      usedAnalyses: 1,
      usedTokens: 0,
    });
  });

  it("blocks a fresh analysis at the quota boundary", async () => {
    const alice = await createTestUser("Alice");

    await prisma.workspaceEntitlement.update({
      data: { analysesPerMonth: 1 },
      where: { workspaceId: alice.workspace.id },
    });
    await recordAnalysisUsage(prisma, {
      analysisId: null,
      idempotencyKey: "analysis:only",
      workspaceId: alice.workspace.id,
    });

    const entitlement = await getWorkspaceEntitlement(prisma, alice.workspace.id);

    expect(gateReason(entitlement)).toBe("LIMIT_EXCEEDED");
  });

  it("returns the quota unit when an analysis never started", async () => {
    const alice = await createTestUser("Alice");
    const key = "analysis:failed";

    await recordAnalysisUsage(prisma, {
      analysisId: null,
      idempotencyKey: key,
      workspaceId: alice.workspace.id,
    });
    await releaseAnalysisUsage(prisma, {
      analysisId: null,
      idempotencyKey: key,
      workspaceId: alice.workspace.id,
    });

    const entitlement = await getWorkspaceEntitlement(prisma, alice.workspace.id);

    expect(entitlement?.usedAnalyses).toBe(0);
  });

  it("reads counters that were forced negative as zero", async () => {
    const alice = await createTestUser("Alice");

    await prisma.workspaceUsage.create({
      data: {
        aiTokensUsed: -10,
        analysesCount: -1,
        periodStart: periodStartOf(new Date()),
        workspaceId: alice.workspace.id,
      },
    });

    const entitlement = await getWorkspaceEntitlement(prisma, alice.workspace.id);

    expect(entitlement?.usedAnalyses).toBe(0);
    expect(entitlement?.usedTokens).toBe(0);
  });

  it("reports payment required for a suspended workspace", async () => {
    const alice = await createTestUser("Alice");

    await prisma.workspaceEntitlement.update({
      data: { accessState: "SUSPENDED" },
      where: { workspaceId: alice.workspace.id },
    });

    const entitlement = await getWorkspaceEntitlement(prisma, alice.workspace.id);

    expect(entitlement?.hasAccess).toBe(false);
    expect(gateReason(entitlement)).toBe("PAYMENT_REQUIRED");
  });

  it("lets owner and member read the same entitlement and hides it from an outsider", async () => {
    const alice = await createTestUser("Alice");
    const bob = await createBareTestUser("Bob");
    const outsider = await createBareTestUser("Mallory");

    await prisma.workspaceMember.create({
      data: { role: "MEMBER", userId: bob.user.id, workspaceId: alice.workspace.id },
    });

    const bobDb = enhance(prisma, { user: { id: bob.user.id, role: bob.user.role } });
    const outsiderDb = enhance(prisma, {
      user: { id: outsider.user.id, role: outsider.user.role },
    });

    const ownerRows = await alice.db.workspaceEntitlement.findMany();
    const memberRows = await bobDb.workspaceEntitlement.findMany();
    const outsiderRows = await outsiderDb.workspaceEntitlement.findMany();

    expect(ownerRows).toHaveLength(1);
    expect(memberRows).toHaveLength(1);
    expect(memberRows[0]?.workspaceId).toBe(ownerRows[0]?.workspaceId);
    expect(outsiderRows).toHaveLength(0);
  });
});
