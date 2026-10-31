import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DbClient } from "@/server/core/db";

import { proPlan } from "./billing.catalog";
import { markSubscriptionActivated, projectSubscription } from "./billing.subscriptions";

const WORKSPACE_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d";
const NOW = new Date("2026-10-30T12:00:00.000Z");
const OLD_ACTIVATION = new Date("2026-09-01T00:00:00.000Z");

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    cancel_at: null,
    cancel_at_period_end: false,
    customer: "cus_1",
    id: "sub_1",
    items: {
      data: [
        {
          current_period_end: 1_800_000_000,
          current_period_start: 1_790_000_000,
          id: "si_1",
          price: {
            currency: "usd",
            id: proPlan().priceId,
            recurring: { interval: "month" },
          },
          quantity: 2,
        },
      ],
    },
    latest_invoice: "in_1",
    status: "active",
    ...overrides,
  };
}

function ownership() {
  return { billingCustomerId: "bc_1", customerId: "cus_1", workspaceId: WORKSPACE_ID };
}

function createTx() {
  const tx = {
    billingIssue: {
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    billingSubscription: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      upsert: vi.fn().mockResolvedValue({ id: "bs_1" }),
    },
    workspaceEntitlement: {
      findUnique: vi.fn().mockResolvedValue({
        accessState: "ACTIVE",
        sourceSubscriptionId: "bs_old",
      }),
      upsert: vi.fn().mockResolvedValue({}),
    },
    workspaceMember: { count: vi.fn().mockResolvedValue(0) },
  };

  return tx;
}

function callArg(mock: ReturnType<typeof vi.fn>, index = 0): Record<string, unknown> {
  const call = mock.mock.calls[index]?.[0] as Record<string, unknown> | undefined;

  expect(call).toBeDefined();

  return call as Record<string, unknown>;
}

describe("projectSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps one current subscription and leaves history as null", async () => {
    const tx = createTx();
    tx.billingSubscription.findUnique.mockResolvedValue({
      activatedAt: NOW,
      externalStatus: "active",
      graceEndsAt: null,
    });

    const result = await projectSubscription(tx as unknown as DbClient, {
      now: NOW,
      ownership: ownership(),
      subscription: subscription() as never,
    });

    expect(result.accessState).toBe("ACTIVE");
    expect(tx.billingSubscription.updateMany).toHaveBeenCalledWith({
      data: { isCurrent: null },
      where: {
        externalSubscriptionId: { not: "sub_1" },
        isCurrent: true,
        workspaceId: WORKSPACE_ID,
      },
    });
    expect(callArg(tx.billingSubscription.upsert)).toMatchObject({
      create: { isCurrent: true },
      update: { isCurrent: true },
    });
  });

  it("keeps a terminal subscription out of the current slot", async () => {
    const tx = createTx();
    tx.billingSubscription.findUnique.mockResolvedValue({
      activatedAt: NOW,
      externalStatus: "active",
      graceEndsAt: null,
      id: "bs_1",
      isCurrent: true,
    });

    await projectSubscription(tx as unknown as DbClient, {
      now: NOW,
      ownership: ownership(),
      subscription: subscription({ status: "canceled" }) as never,
    });

    const mirror = callArg(tx.billingSubscription.upsert);

    expect((mirror.create as Record<string, unknown>).isCurrent).toBeNull();
    expect((mirror.update as Record<string, unknown>).isCurrent).toBeNull();
    expect(callArg(tx.workspaceEntitlement.upsert)).toMatchObject({
      update: { accessState: "CANCELED", planCode: "HOBBY", seatLimit: 0 },
    });
  });

  it("increments revision only when the access state changes", async () => {
    const tx = createTx();
    tx.billingSubscription.findUnique.mockResolvedValue({
      activatedAt: NOW,
      externalStatus: "active",
      graceEndsAt: null,
    });
    tx.workspaceEntitlement.findUnique.mockResolvedValue({
      accessState: "PENDING",
      sourceSubscriptionId: "bs_old",
    });

    await projectSubscription(tx as unknown as DbClient, {
      now: NOW,
      ownership: ownership(),
      subscription: subscription() as never,
    });

    const entitlement = callArg(tx.workspaceEntitlement.upsert);

    expect((entitlement.update as Record<string, unknown>).revision).toEqual({ increment: 1 });

    const unchangedTx = createTx();
    unchangedTx.billingSubscription.findUnique.mockResolvedValue({
      activatedAt: NOW,
      externalStatus: "active",
      graceEndsAt: null,
    });

    await projectSubscription(unchangedTx as unknown as DbClient, {
      now: NOW,
      ownership: ownership(),
      subscription: subscription() as never,
    });

    const unchanged = callArg(unchangedTx.workspaceEntitlement.upsert);

    expect((unchanged.update as Record<string, unknown>).revision).toBeUndefined();
  });

  it("grants PRO features and quotas when a paid subscription is projected", async () => {
    const tx = createTx();
    tx.billingSubscription.findUnique.mockResolvedValue({
      activatedAt: NOW,
      externalStatus: "active",
      graceEndsAt: null,
    });

    await projectSubscription(tx as unknown as DbClient, {
      now: NOW,
      ownership: ownership(),
      subscription: subscription() as never,
    });

    const entitlement = callArg(tx.workspaceEntitlement.upsert);

    expect(entitlement.create).toMatchObject({
      aiTokensPerMonth: 20_000_000,
      analysesPerMonth: 500,
      autoResync: true,
      historyDays: 90,
      planCode: "PRO",
      privateReposAllowed: true,
      prReviews: true,
    });
    expect(entitlement.update).toMatchObject({
      aiTokensPerMonth: 20_000_000,
      analysesPerMonth: 500,
      autoResync: true,
      historyDays: 90,
      privateReposAllowed: true,
      prReviews: true,
    });
  });

  it("writes the grace deadline into the entitlement so grace actually grants access", async () => {
    const tx = createTx();
    const graceEndsAt = new Date(NOW.getTime() + 86_400_000);
    tx.billingSubscription.findUnique.mockResolvedValue({
      activatedAt: OLD_ACTIVATION,
      externalStatus: "past_due",
      graceEndsAt,
    });
    tx.workspaceEntitlement.findUnique.mockResolvedValue({
      accessState: "ACTIVE",
      sourceSubscriptionId: "bs_old",
    });

    const result = await projectSubscription(tx as unknown as DbClient, {
      now: NOW,
      ownership: ownership(),
      subscription: subscription({ status: "past_due" }) as never,
    });

    expect(result.accessState).toBe("GRACE");
    expect(callArg(tx.workspaceEntitlement.upsert)).toMatchObject({
      update: { graceEndsAt, planCode: "PRO" },
    });
  });

  it("heals a PRO row whose limits are still the HOBBY ones", async () => {
    const tx = createTx();
    tx.billingSubscription.findUnique.mockResolvedValue({
      activatedAt: NOW,
      externalStatus: "active",
      graceEndsAt: null,
    });
    tx.workspaceEntitlement.findUnique.mockResolvedValue({
      accessState: "ACTIVE",
      aiTokensPerMonth: 1_000_000,
      analysesPerMonth: 20,
      autoResync: false,
      historyDays: 7,
      planCode: "PRO",
      privateReposAllowed: false,
      prReviews: false,
      reposLimit: null,
      sourceSubscriptionId: "bs_old",
    });

    await projectSubscription(tx as unknown as DbClient, {
      now: NOW,
      ownership: ownership(),
      subscription: subscription() as never,
    });

    // The plan code did not change, but the limits did not match PRO: the row must be repaired.
    expect(callArg(tx.workspaceEntitlement.upsert)).toMatchObject({
      update: { analysesPerMonth: 500, privateReposAllowed: true, prReviews: true },
    });
  });

  it("falls back to HOBBY features when the subscription is terminal", async () => {
    const tx = createTx();
    tx.billingSubscription.findUnique.mockResolvedValue({
      activatedAt: NOW,
      externalStatus: "active",
      graceEndsAt: null,
      id: "bs_1",
      isCurrent: true,
    });

    await projectSubscription(tx as unknown as DbClient, {
      now: NOW,
      ownership: ownership(),
      subscription: subscription({ status: "canceled" }) as never,
    });

    expect(callArg(tx.workspaceEntitlement.upsert)).toMatchObject({
      update: {
        aiTokensPerMonth: 1_000_000,
        analysesPerMonth: 20,
        autoResync: false,
        historyDays: 7,
        planCode: "HOBBY",
        privateReposAllowed: false,
        prReviews: false,
      },
    });
  });

  it("activates on the first projection instead of losing activatedAt before the row exists", async () => {
    const tx = createTx();
    const paidAt = new Date("2026-10-01T00:00:00.000Z");
    // `billingSubscription.findUnique` returns null: this is the very first event for the id.

    const result = await projectSubscription(tx as unknown as DbClient, {
      now: NOW,
      ownership: ownership(),
      subscription: subscription({
        latest_invoice: {
          id: "in_1",
          status: "paid",
          status_transitions: { paid_at: Math.floor(paidAt.getTime() / 1000) },
        },
      }) as never,
    });

    expect(result.accessState).toBe("ACTIVE");
    expect(
      (callArg(tx.billingSubscription.upsert).create as Record<string, unknown>).activatedAt,
    ).toEqual(paidAt);
  });

  it("lets an operator override leave a revived terminal review", async () => {
    const tx = createTx();
    tx.billingSubscription.findUnique.mockResolvedValue({
      activatedAt: NOW,
      externalStatus: "canceled",
      graceEndsAt: null,
      needsReview: false,
      reviewReason: null,
    });
    tx.workspaceEntitlement.findUnique.mockResolvedValue({
      accessState: "REVIEW",
      sourceSubscriptionId: "bs_1",
    });

    const result = await projectSubscription(tx as unknown as DbClient, {
      now: NOW,
      overrideRevivedTerminal: true,
      ownership: ownership(),
      subscription: subscription() as never,
    });

    expect(result.accessState).toBe("ACTIVE");
  });

  it("turns a revived terminal subscription into REVIEW", async () => {
    const tx = createTx();
    tx.billingSubscription.findUnique.mockResolvedValue({
      activatedAt: NOW,
      externalStatus: "canceled",
      graceEndsAt: null,
    });
    tx.workspaceEntitlement.findUnique.mockResolvedValue({
      accessState: "CANCELED",
      sourceSubscriptionId: "bs_1",
    });

    const result = await projectSubscription(tx as unknown as DbClient, {
      now: NOW,
      ownership: ownership(),
      subscription: subscription() as never,
    });

    expect(result.accessState).toBe("REVIEW");
    expect(result.reviewReason).toBe("REVIVED_TERMINAL_SUBSCRIPTION");
    expect(callArg(tx.workspaceEntitlement.upsert)).toMatchObject({
      update: { accessState: "REVIEW" },
    });
    // A review state without an issue is invisible to operators.
    expect(tx.billingIssue.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            kind: "SUBSCRIPTION_REVIEW",
            severity: "CRITICAL",
            status: "OPEN",
          }),
        ],
      }),
    );
  });

  it("accepts a new subscription id after a cancellation", async () => {
    const tx = createTx();
    tx.workspaceEntitlement.findUnique.mockResolvedValue({
      accessState: "CANCELED",
      sourceSubscriptionId: "bs_old",
    });

    const result = await projectSubscription(tx as unknown as DbClient, {
      now: NOW,
      ownership: ownership(),
      subscription: subscription() as never,
    });

    expect(result.accessState).toBe("PENDING");
  });

  it("treats an ACTIVE personal workspace without a subscription as NO_SUBSCRIPTION", async () => {
    const tx = createTx();
    tx.workspaceEntitlement.findUnique.mockResolvedValue({
      accessState: "ACTIVE",
      sourceSubscriptionId: null,
    });

    const result = await projectSubscription(tx as unknown as DbClient, {
      now: NOW,
      ownership: ownership(),
      subscription: subscription() as never,
    });

    expect(result.accessState).toBe("PENDING");
  });

  it("never rewrites access from a historical subscription", async () => {
    const tx = createTx();
    tx.billingSubscription.findUnique.mockResolvedValue({
      activatedAt: OLD_ACTIVATION,
      externalStatus: "active",
      graceEndsAt: null,
      id: "bs_historical",
      isCurrent: null,
      needsReview: false,
      reviewReason: null,
    });
    tx.billingSubscription.findFirst.mockResolvedValue({ externalStatus: "active" });
    tx.workspaceEntitlement.findUnique.mockResolvedValue({
      accessState: "ACTIVE",
      sourceSubscriptionId: "bs_live",
    });

    const result = await projectSubscription(tx as unknown as DbClient, {
      now: NOW,
      ownership: ownership(),
      subscription: subscription({ id: "sub_historical", status: "canceled" }) as never,
    });

    expect(result.ownsAccess).toBe(false);
    expect(result.accessState).toBe("ACTIVE");
    expect(tx.workspaceEntitlement.upsert).not.toHaveBeenCalled();
    expect(tx.billingSubscription.updateMany).not.toHaveBeenCalled();
    expect(callArg(tx.billingSubscription.upsert)).toMatchObject({
      create: { isCurrent: null },
      update: { isCurrent: null },
    });
  });

  it("does not treat an entitlement source as ownership while a live current exists", async () => {
    const tx = createTx();
    tx.billingSubscription.findUnique.mockResolvedValue({
      activatedAt: OLD_ACTIVATION,
      externalStatus: "active",
      graceEndsAt: null,
      id: "bs_historical",
      isCurrent: null,
      needsReview: false,
      reviewReason: null,
    });
    tx.workspaceEntitlement.findUnique.mockResolvedValue({
      accessState: "ACTIVE",
      sourceSubscriptionId: "bs_historical",
    });
    tx.billingSubscription.findFirst.mockResolvedValue({ externalStatus: "active" });

    const result = await projectSubscription(tx as unknown as DbClient, {
      now: NOW,
      ownership: ownership(),
      subscription: subscription({ id: "sub_historical", status: "canceled" }) as never,
    });

    expect(result.ownsAccess).toBe(false);
    expect(tx.workspaceEntitlement.upsert).not.toHaveBeenCalled();
    expect(tx.billingSubscription.updateMany).not.toHaveBeenCalled();
  });

  it("refuses to take the current slot while another live subscription holds it", async () => {
    const tx = createTx();
    tx.billingSubscription.findFirst.mockResolvedValue({ externalStatus: "active" });

    const result = await projectSubscription(tx as unknown as DbClient, {
      now: NOW,
      ownership: ownership(),
      subscription: subscription({ id: "sub_duplicate" }) as never,
    });

    expect(result.ownsAccess).toBe(false);
    expect(tx.workspaceEntitlement.upsert).not.toHaveBeenCalled();
    expect(tx.billingSubscription.updateMany).not.toHaveBeenCalled();
  });

  it("takes the current slot from a terminal subscription when the caller allows it", async () => {
    const tx = createTx();
    tx.billingSubscription.findFirst.mockResolvedValue({ externalStatus: "canceled" });

    const result = await projectSubscription(tx as unknown as DbClient, {
      allowCurrentTakeover: true,
      now: NOW,
      ownership: ownership(),
      subscription: subscription({ id: "sub_new" }) as never,
    });

    expect(result.ownsAccess).toBe(true);
    expect(callArg(tx.workspaceEntitlement.upsert)).toBeDefined();
  });

  it("does not evict a terminal current subscription without a canonical check", async () => {
    const tx = createTx();
    tx.billingSubscription.findFirst.mockResolvedValue({ externalStatus: "canceled" });

    const result = await projectSubscription(tx as unknown as DbClient, {
      now: NOW,
      ownership: ownership(),
      subscription: subscription({ id: "sub_new" }) as never,
    });

    expect(result.ownsAccess).toBe(false);
    expect(tx.workspaceEntitlement.upsert).not.toHaveBeenCalled();
    expect(tx.billingIssue.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ kind: "DUPLICATE_ACTIVE_SUBSCRIPTION" })],
      }),
    );
  });

  it("surfaces a live duplicate even when the worker sees it first", async () => {
    const tx = createTx();
    tx.billingSubscription.findFirst.mockResolvedValue({ externalStatus: "active" });

    const result = await projectSubscription(tx as unknown as DbClient, {
      now: NOW,
      ownership: ownership(),
      subscription: subscription({ id: "sub_duplicate" }) as never,
    });

    expect(result.ownsAccess).toBe(false);
    expect(tx.workspaceEntitlement.upsert).not.toHaveBeenCalled();
    expect(tx.billingSubscription.updateMany).not.toHaveBeenCalled();
    expect(tx.billingIssue.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            dedupeKey: "duplicate_active:sub_duplicate",
            kind: "DUPLICATE_ACTIVE_SUBSCRIPTION",
            severity: "CRITICAL",
          }),
        ],
      }),
    );
  });

  it("cancels access when the only subscription is terminal", async () => {
    const tx = createTx();
    tx.workspaceEntitlement.findUnique.mockResolvedValue({
      accessState: "ACTIVE",
      sourceSubscriptionId: null,
    });

    const result = await projectSubscription(tx as unknown as DbClient, {
      now: NOW,
      ownership: ownership(),
      subscription: subscription({ status: "canceled" }) as never,
    });

    expect(result.ownsAccess).toBe(true);
    expect(callArg(tx.workspaceEntitlement.upsert)).toMatchObject({
      update: { accessState: "CANCELED", planCode: "HOBBY" },
    });
    expect(callArg(tx.billingSubscription.upsert)).toMatchObject({
      create: { isCurrent: null, needsReview: false },
    });
  });

  it("does not let an older terminal subscription free a terminal current slot", async () => {
    const tx = createTx();
    tx.billingSubscription.findUnique.mockResolvedValue({
      activatedAt: OLD_ACTIVATION,
      externalStatus: "canceled",
      graceEndsAt: null,
      id: "bs_history",
      isCurrent: null,
      needsReview: false,
      reviewReason: null,
    });
    tx.billingSubscription.findFirst.mockResolvedValue({ externalStatus: "canceled" });

    const result = await projectSubscription(tx as unknown as DbClient, {
      now: NOW,
      ownership: ownership(),
      subscription: subscription({ id: "sub_history", status: "canceled" }) as never,
    });

    expect(result.ownsAccess).toBe(false);
    expect(tx.workspaceEntitlement.upsert).not.toHaveBeenCalled();
    expect(tx.billingSubscription.updateMany).not.toHaveBeenCalled();
  });

  it("never overwrites activatedAt", async () => {
    const tx = createTx();
    tx.billingSubscription.findUnique.mockResolvedValue({
      activatedAt: OLD_ACTIVATION,
      externalStatus: "active",
      graceEndsAt: null,
    });

    await projectSubscription(tx as unknown as DbClient, {
      now: NOW,
      ownership: ownership(),
      subscription: subscription() as never,
    });

    const mirror = callArg(tx.billingSubscription.upsert);

    expect(mirror.update).not.toHaveProperty("activatedAt");
    // The create branch is not used here, but it must carry the known activation, not wipe it.
    expect(mirror.create).toMatchObject({ activatedAt: OLD_ACTIVATION });
  });

  it("stores an unknown status verbatim and reviews the entitlement", async () => {
    const tx = createTx();

    const result = await projectSubscription(tx as unknown as DbClient, {
      now: NOW,
      ownership: ownership(),
      subscription: subscription({ status: "some_future_status" }) as never,
    });

    expect(result.accessState).toBe("REVIEW");
    expect(callArg(tx.billingSubscription.upsert)).toMatchObject({
      create: { externalStatus: "some_future_status" },
    });
  });

  it("reviews an unknown price", async () => {
    const tx = createTx();
    const unknownPrice = subscription();
    const item = unknownPrice.items.data[0];

    if (item == null) {
      throw new Error("fixture must have one item");
    }

    item.price.id = "price_unknown";

    const result = await projectSubscription(tx as unknown as DbClient, {
      now: NOW,
      ownership: ownership(),
      subscription: unknownPrice as never,
    });

    expect(result.accessState).toBe("REVIEW");
    expect(result.reviewReason).toBe("UNKNOWN_PRICE");
  });
});

describe("markSubscriptionActivated", () => {
  it("records the first activation only", async () => {
    const db = { billingSubscription: { updateMany: vi.fn() } };
    db.billingSubscription.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const first = await markSubscriptionActivated(db as unknown as DbClient, {
      activatedAt: NOW,
      externalSubscriptionId: "sub_1",
    });
    const second = await markSubscriptionActivated(db as unknown as DbClient, {
      activatedAt: new Date(),
      externalSubscriptionId: "sub_1",
    });

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(db.billingSubscription.updateMany).toHaveBeenCalledWith({
      data: { activatedAt: NOW },
      where: { activatedAt: null, externalSubscriptionId: "sub_1" },
    });
  });

  it("keeps the seat limit at the paid quantity and raises an issue", async () => {
    const tx = createTx();
    tx.billingSubscription.findUnique.mockResolvedValue({
      activatedAt: NOW,
      externalStatus: "active",
      graceEndsAt: null,
    });
    tx.workspaceMember.count.mockResolvedValue(5);

    await projectSubscription(tx as unknown as DbClient, {
      now: NOW,
      ownership: ownership(),
      subscription: subscription({
        items: { data: [{ ...subscription().items.data[0], quantity: 2 }] },
      }) as never,
    });

    expect(callArg(tx.workspaceEntitlement.upsert)).toMatchObject({
      update: { seatLimit: 2 },
    });
    expect(tx.billingIssue.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ kind: "SEATS_BELOW_MEMBERS" })],
      }),
    );
  });

  it("activates from a paid latest invoice when invoice.paid was lost", async () => {
    const tx = createTx();
    const paidAt = new Date("2026-10-20T10:00:00.000Z");
    tx.billingSubscription.findUnique.mockResolvedValue({
      activatedAt: null,
      externalStatus: "active",
      graceEndsAt: null,
    });

    const result = await projectSubscription(tx as unknown as DbClient, {
      now: NOW,
      ownership: ownership(),
      subscription: subscription({
        latest_invoice: {
          status: "paid",
          status_transitions: { paid_at: Math.floor(paidAt.getTime() / 1000) },
        },
      }) as never,
    });

    expect(result.accessState).toBe("ACTIVE");
    expect(tx.billingSubscription.updateMany).toHaveBeenCalledWith({
      data: { activatedAt: paidAt },
      where: { activatedAt: null, externalSubscriptionId: "sub_1" },
    });
  });

  it("does not move activatedAt when a later event repeats it", async () => {
    const tx = createTx();
    tx.billingSubscription.findUnique.mockResolvedValue({
      activatedAt: OLD_ACTIVATION,
      externalStatus: "active",
      graceEndsAt: null,
    });

    await projectSubscription(tx as unknown as DbClient, {
      now: NOW,
      ownership: ownership(),
      subscription: subscription({
        latest_invoice: {
          status: "paid",
          status_transitions: { paid_at: Math.floor(NOW.getTime() / 1000) },
        },
      }) as never,
    });

    expect(tx.billingSubscription.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: { activatedAt: expect.any(Date) } }),
    );
  });

  it("copies activatedAt into the entitlement when it becomes ACTIVE", async () => {
    const tx = createTx();
    tx.billingSubscription.findUnique.mockResolvedValue({
      activatedAt: OLD_ACTIVATION,
      externalStatus: "active",
      graceEndsAt: null,
    });

    await projectSubscription(tx as unknown as DbClient, {
      now: NOW,
      ownership: ownership(),
      subscription: subscription() as never,
    });

    expect(callArg(tx.workspaceEntitlement.upsert)).toMatchObject({
      update: { activatedAt: OLD_ACTIVATION },
    });
  });
});
