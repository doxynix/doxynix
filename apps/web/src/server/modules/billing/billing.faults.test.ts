import { readFileSync } from "node:fs";

import { join } from "pathe";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { processStripeEvent } from "./billing.events";

const WORKSPACE_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d";

const dbMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  billingCustomer: { findFirst: vi.fn() },
  billingEvent: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  billingIssue: {
    createMany: vi.fn().mockResolvedValue({ count: 1 }),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
  billingSubscription: { findUnique: vi.fn() },
}));

const triggerMock = vi.hoisted(() => vi.fn());
const stripeMock = vi.hoisted(() => ({ subscriptions: { retrieve: vi.fn() } }));

vi.mock("@/server/core/db", () => ({ prisma: dbMock }));
vi.mock("@trigger.dev/sdk", () => ({ tasks: { trigger: triggerMock } }));
vi.mock("./billing.stripe", () => ({ getStripeClient: () => stripeMock }));

const FIXTURES_DIR = join(import.meta.dirname, "test-fixtures", "events");

function fixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, `${name}.json`), "utf8");
}

function subscriptionEvent() {
  return JSON.parse(fixture("subscription-updated")) as Record<string, unknown>;
}

function subscriptionFixture() {
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
          price: { currency: "usd", id: "price_test", recurring: { interval: "month" } },
          quantity: 2,
        },
      ],
    },
    latest_invoice: "in_1",
    status: "active",
  };
}

function httpError(statusCode: number) {
  return Object.assign(new Error(`stripe ${statusCode}`), { statusCode });
}

describe("worker fault injection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.billingEvent.findUnique.mockResolvedValue({
      id: "be_1",
      payload: subscriptionEvent(),
      status: "ENQUEUED",
    });
    dbMock.billingEvent.update.mockResolvedValue({});
    dbMock.billingCustomer.findFirst.mockResolvedValue({
      id: "bc_1",
      workspaceId: WORKSPACE_ID,
    });
    dbMock.billingSubscription.findUnique.mockResolvedValue(null);
    dbMock.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(dbMock));
    triggerMock.mockResolvedValue({ id: "run_1" });
  });

  it.each([
    ["429", httpError(429)],
    ["500", httpError(500)],
    ["network timeout", Object.assign(new Error("timeout"), { code: "ETIMEDOUT" })],
  ])("surfaces a Stripe %s so the task retries", async (_label, error) => {
    stripeMock.subscriptions.retrieve.mockRejectedValue(error);

    await expect(processStripeEvent("be_1")).rejects.toBe(error);
    expect(dbMock.billingEvent.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "DEAD_LETTER" }) }),
    );
  });

  it("surfaces a database failure inside the transaction", async () => {
    stripeMock.subscriptions.retrieve.mockResolvedValue(subscriptionFixture());
    dbMock.$transaction.mockRejectedValue(new Error("transaction failed"));

    await expect(processStripeEvent("be_1")).rejects.toThrow("transaction failed");
    expect(dbMock.billingEvent.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "DEAD_LETTER" }) }),
    );
  });
});
