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
    billingIssue: { upsert: vi.fn().mockResolvedValue({}) },
    billingSubscription: {
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
      graceEndsAt: null,
      stripeStatus: "active",
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
        isCurrent: true,
        stripeSubscriptionId: { not: "sub_1" },
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
      graceEndsAt: null,
      stripeStatus: "active",
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
      graceEndsAt: null,
      stripeStatus: "active",
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
      graceEndsAt: null,
      stripeStatus: "active",
    });

    await projectSubscription(unchangedTx as unknown as DbClient, {
      now: NOW,
      ownership: ownership(),
      subscription: subscription() as never,
    });

    const unchanged = callArg(unchangedTx.workspaceEntitlement.upsert);

    expect((unchanged.update as Record<string, unknown>).revision).toBeUndefined();
  });

  it("turns a revived terminal subscription into REVIEW", async () => {
    const tx = createTx();
    tx.billingSubscription.findUnique.mockResolvedValue({
      activatedAt: NOW,
      graceEndsAt: null,
      stripeStatus: "canceled",
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

  it("never overwrites activatedAt", async () => {
    const tx = createTx();
    tx.billingSubscription.findUnique.mockResolvedValue({
      activatedAt: OLD_ACTIVATION,
      graceEndsAt: null,
      stripeStatus: "active",
    });

    await projectSubscription(tx as unknown as DbClient, {
      now: NOW,
      ownership: ownership(),
      subscription: subscription() as never,
    });

    const mirror = callArg(tx.billingSubscription.upsert);

    expect(mirror.update).not.toHaveProperty("activatedAt");
    expect(mirror.create).toMatchObject({ activatedAt: null });
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
      create: { stripeStatus: "some_future_status" },
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
      stripeSubscriptionId: "sub_1",
    });
    const second = await markSubscriptionActivated(db as unknown as DbClient, {
      activatedAt: new Date(),
      stripeSubscriptionId: "sub_1",
    });

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(db.billingSubscription.updateMany).toHaveBeenCalledWith({
      data: { activatedAt: NOW },
      where: { activatedAt: null, stripeSubscriptionId: "sub_1" },
    });
  });

  it("never shrinks the seat limit below the active members and raises an issue", async () => {
    const tx = createTx();
    tx.billingSubscription.findUnique.mockResolvedValue({
      activatedAt: NOW,
      graceEndsAt: null,
      stripeStatus: "active",
    });
    tx.workspaceMember.count.mockResolvedValue(3);

    await projectSubscription(tx as unknown as DbClient, {
      now: NOW,
      ownership: ownership(),
      subscription: subscription({
        items: { data: [{ ...subscription().items.data[0], quantity: 2 }] },
      }) as never,
    });

    expect(callArg(tx.workspaceEntitlement.upsert)).toMatchObject({
      update: { seatLimit: 3 },
    });
    expect(tx.billingIssue.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ kind: "SEATS_BELOW_MEMBERS" }),
      }),
    );
  });
});
