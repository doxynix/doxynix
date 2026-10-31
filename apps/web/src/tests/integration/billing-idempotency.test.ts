import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/server/core/db";
import { proPlan } from "@/server/modules/billing/billing.catalog";
import { createCheckoutSession } from "@/server/modules/billing/billing.checkout";
import { changeSeats } from "@/server/modules/billing/billing.plan-changes";

import { cleanupDatabase, createBareTestUser, createTestUser } from "../helpers";

const stripeMock = vi.hoisted(() => ({
  checkout: { sessions: { create: vi.fn() } },
  customers: { create: vi.fn() },
  subscriptions: { update: vi.fn() },
}));

vi.mock("@/server/modules/billing/billing.stripe", () => ({
  getStripeClient: () => stripeMock,
  stripeEnvironment: () => "test",
}));

const REQUEST_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5e";

function checkoutInput(workspaceId: string, userId: string, requestId = REQUEST_ID) {
  return {
    actorUserId: userId,
    db: prisma,
    requestId,
    workspaceId,
  };
}

async function seedActiveSubscription(workspaceId: string) {
  await prisma.billingCustomer.create({
    data: {
      externalCustomerId: `cus_${workspaceId}`,
      livemode: false,
      provider: "stripe",
      workspaceId,
    },
  });
  const customer = await prisma.billingCustomer.findFirstOrThrow({ where: { workspaceId } });

  await prisma.billingSubscription.create({
    data: {
      billingCustomerId: customer.id,
      currency: "usd",
      currentPeriodEnd: new Date("2026-11-29T00:00:00.000Z"),
      currentPeriodStart: new Date("2026-10-29T00:00:00.000Z"),
      isCurrent: true,
      quantity: 1,
      stripePriceId: proPlan().priceId,
      stripeStatus: "active",
      stripeSubscriptionId: `sub_${workspaceId}`,
      stripeSubscriptionItemId: `si_${workspaceId}`,
      workspaceId,
    },
  });
}

describe("billing command idempotency against Postgres", () => {
  beforeEach(async () => {
    await cleanupDatabase();
    stripeMock.checkout.sessions.create
      .mockReset()
      .mockResolvedValue({ id: "cs_int", status: "open", url: "https://checkout.test" });
    stripeMock.customers.create.mockReset().mockResolvedValue({ id: "cus_int", livemode: false });
    stripeMock.subscriptions.update.mockReset().mockResolvedValue({ id: "sub_int" });
  });

  it("creates one operation and one customer for two parallel checkouts", async () => {
    const alice = await createTestUser("Alice");

    const results = await Promise.allSettled([
      createCheckoutSession(checkoutInput(alice.workspace.id, alice.user.id)),
      createCheckoutSession(checkoutInput(alice.workspace.id, alice.user.id)),
    ]);

    const operations = await prisma.billingOperation.count({
      where: { requestId: REQUEST_ID, workspaceId: alice.workspace.id },
    });
    const customers = await prisma.billingCustomer.count({
      where: { workspaceId: alice.workspace.id },
    });

    expect(results.some((result) => result.status === "fulfilled")).toBe(true);
    expect(operations).toBe(1);
    expect(customers).toBe(1);
  });

  it("rejects the same request id when the body changed", async () => {
    const alice = await createTestUser("Alice");
    await createCheckoutSession(checkoutInput(alice.workspace.id, alice.user.id));

    const bob = await createBareTestUser("Bob");
    await prisma.workspaceMember.create({
      data: { role: "MEMBER", userId: bob.user.id, workspaceId: alice.workspace.id },
    });

    await expect(
      createCheckoutSession(checkoutInput(alice.workspace.id, alice.user.id)),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "BILLING_IDEMPOTENCY_CONFLICT",
    });
  });

  it("replays a completed checkout without calling Stripe again", async () => {
    const alice = await createTestUser("Alice");

    await createCheckoutSession(checkoutInput(alice.workspace.id, alice.user.id));
    const replay = await createCheckoutSession(checkoutInput(alice.workspace.id, alice.user.id));

    expect(stripeMock.customers.create).toHaveBeenCalledTimes(1);
    expect(stripeMock.checkout.sessions.create).toHaveBeenCalledTimes(1);
    expect(replay.url).toBeNull();
  });

  it("serializes parallel seat changes for one workspace", async () => {
    const alice = await createTestUser("Alice");
    await seedActiveSubscription(alice.workspace.id);

    let inFlight = 0;
    let maxInFlight = 0;
    const calls: Array<{ quantity: number }> = [];

    stripeMock.subscriptions.update.mockImplementation(
      async (_id: string, params: { items: Array<{ quantity: number }> }) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        calls.push({ quantity: params.items[0]?.quantity ?? 0 });
        await new Promise((resolve) => setTimeout(resolve, 10));
        inFlight -= 1;

        return { id: "sub_int" };
      },
    );

    const results = await Promise.allSettled([
      changeSeats({
        actorUserId: alice.user.id,
        db: prisma,
        quantity: 2,
        requestId: "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4b01",
        workspaceId: alice.workspace.id,
      }),
      changeSeats({
        actorUserId: alice.user.id,
        db: prisma,
        quantity: 3,
        requestId: "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4b02",
        workspaceId: alice.workspace.id,
      }),
    ]);

    expect(results.every((result) => result.status === "fulfilled")).toBe(true);
    // The advisory lock means the second command starts only after the first commits.
    expect(maxInFlight).toBe(1);
    expect(calls).toHaveLength(2);
    expect(new Set(calls.map((call) => call.quantity))).toEqual(new Set([2, 3]));
  });
});
