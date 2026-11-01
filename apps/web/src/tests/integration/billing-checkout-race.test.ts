import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/server/core/db";
import { createCheckoutSession } from "@/server/modules/billing/billing.checkout";

import { cleanupDatabase, createTestUser } from "../helpers";

const CUSTOMER_ID = "cus_race_test";
const STRIPE_DELAY_MS = 50;

const stripeMock = vi.hoisted(() => ({
  checkout: { sessions: { create: vi.fn(), retrieve: vi.fn() } },
  customers: { create: vi.fn() },
}));

vi.mock("@/server/core/billing/stripe-client", () => ({
  getStripeClient: () => stripeMock,
  providerEnvironment: () => "test",
}));

function session(index: number) {
  return {
    id: `cs_race_${index}`,
    status: "open",
    url: `https://checkout.stripe.com/c/pay/cs_race_${index}`,
  };
}

describe("checkout concurrency", () => {
  beforeEach(async () => {
    await cleanupDatabase();
    stripeMock.checkout.sessions.create.mockReset();
    stripeMock.checkout.sessions.retrieve.mockReset();
    stripeMock.customers.create.mockReset().mockResolvedValue({ id: CUSTOMER_ID, livemode: false });
  });

  it("opens exactly one Stripe session for two concurrent requests", async () => {
    let calls = 0;
    stripeMock.checkout.sessions.create.mockImplementation(async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, STRIPE_DELAY_MS));

      return session(calls);
    });

    const alice = await createTestUser("RaceOwner");
    const input = (requestId: string) => ({
      actorUserId: alice.user.id,
      db: prisma,
      requestId,
      workspaceId: alice.workspace.id,
    });

    const results = await Promise.allSettled([
      createCheckoutSession(input(crypto.randomUUID())),
      createCheckoutSession(input(crypto.randomUUID())),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    expect(stripeMock.checkout.sessions.create).toHaveBeenCalledTimes(1);
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({
      reason: { message: "CHECKOUT_IN_PROGRESS" },
    });

    const rows = await prisma.billingCheckoutSession.findMany({
      where: { workspaceId: alice.workspace.id },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.externalCheckoutSessionId).toBe("cs_race_1");
    expect(rows[0]?.externalStatus).toBe("open");
  });

  it("clears an abandoned placeholder instead of blocking the next attempt", async () => {
    stripeMock.checkout.sessions.create.mockResolvedValue(session(2));

    const alice = await createTestUser("AbandonedOwner");

    await prisma.billingCheckoutSession.create({
      data: {
        createdAt: new Date(Date.now() - 11 * 60 * 1000),
        externalCheckoutSessionId: "pending:abandoned",
        externalCustomerId: "",
        externalStatus: "pending",
        workspaceId: alice.workspace.id,
      },
    });

    const result = await createCheckoutSession({
      actorUserId: alice.user.id,
      db: prisma,
      requestId: crypto.randomUUID(),
      workspaceId: alice.workspace.id,
    });

    expect(result.sessionId).toBe("cs_race_2");
    expect(stripeMock.checkout.sessions.create).toHaveBeenCalledTimes(1);

    const rows = await prisma.billingCheckoutSession.findMany({
      where: { workspaceId: alice.workspace.id },
    });

    expect(rows.map((row) => row.externalCheckoutSessionId)).toEqual(["cs_race_2"]);
  });
});
