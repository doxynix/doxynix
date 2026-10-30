import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DbClient } from "@/server/core/db";

import { applyRiskEvent, type RiskLinks, resolveRiskLinks } from "./billing.risk";

const WORKSPACE_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d";
const OWNERSHIP = {
  billingCustomerId: "bc_1",
  customerId: "cus_1",
  workspaceId: WORKSPACE_ID,
};

const stripeMock = vi.hoisted(() => ({
  charges: { retrieve: vi.fn() },
  disputes: { retrieve: vi.fn() },
  invoicePayments: { list: vi.fn() },
  invoices: { retrieve: vi.fn() },
  radar: { earlyFraudWarnings: { retrieve: vi.fn() } },
  refunds: { retrieve: vi.fn() },
}));

vi.mock("./billing.stripe", () => ({ getStripeClient: () => stripeMock }));

type LedgerRow = { amount: bigint; entryKey: string; kind: string };

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields", {
    clientVersion: Prisma.prismaVersion.client,
    code: "P2002",
  });
}

function asyncIterable<T>(items: Array<T>) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const item of items) {
        yield item;
      }
    },
  };
}

function createFakeTx() {
  const ledger = new Map<string, LedgerRow>();

  const tx = {
    billingIssue: { upsert: vi.fn().mockResolvedValue({}) },
    billingLedgerEntry: {
      create: vi.fn(async ({ data }: { data: LedgerRow }) => {
        if (ledger.has(data.entryKey)) {
          throw uniqueViolation();
        }

        ledger.set(data.entryKey, data);

        return data;
      }),
    },
  };

  return { issues: tx.billingIssue.upsert, ledger, tx: tx as unknown as DbClient };
}

function refund(overrides: Record<string, unknown> = {}) {
  return {
    amount: 1900,
    charge: "ch_1",
    created: 1_790_000_000,
    currency: "usd",
    id: "re_1",
    payment_intent: "pi_1",
    status: "succeeded",
    ...overrides,
  };
}

function dispute(overrides: Record<string, unknown> = {}) {
  return {
    amount: 1900,
    charge: "ch_1",
    created: 1_790_000_000,
    currency: "usd",
    id: "dp_1",
    payment_intent: "pi_1",
    status: "needs_response",
    ...overrides,
  };
}

const LINKS: RiskLinks = {
  invoiceId: "in_1",
  paymentIntentId: "pi_1",
  subscriptionId: "sub_1",
};

describe("resolveRiskLinks", () => {
  beforeEach(() => {
    stripeMock.charges.retrieve.mockReset();
    stripeMock.invoicePayments.list.mockReset();
    stripeMock.invoices.retrieve.mockReset();
  });

  it("resolves a null PaymentIntent through the charge", async () => {
    stripeMock.charges.retrieve.mockResolvedValue({ payment_intent: "pi_1" });
    stripeMock.invoicePayments.list.mockReturnValue(
      asyncIterable([
        {
          invoice: {
            id: "in_1",
            parent: {
              subscription_details: { subscription: "sub_1" },
              type: "subscription_details",
            },
          },
        },
      ]),
    );

    const links = await resolveRiskLinks({
      kind: "refund",
      refund: refund({ payment_intent: null }) as never,
    });

    expect(stripeMock.charges.retrieve).toHaveBeenCalledWith("ch_1");
    expect(links).toEqual({
      invoiceId: "in_1",
      paymentIntentId: "pi_1",
      subscriptionId: "sub_1",
    });
  });

  it("skips non-subscription invoices and keeps paginating", async () => {
    stripeMock.invoicePayments.list.mockReturnValue(
      asyncIterable([
        {
          invoice: {
            id: "in_one_off",
            parent: { quote_details: null, subscription_details: null, type: "quote_details" },
          },
        },
        {
          invoice: {
            id: "in_sub",
            parent: {
              subscription_details: { subscription: "sub_9" },
              type: "subscription_details",
            },
          },
        },
      ]),
    );

    const links = await resolveRiskLinks({ kind: "refund", refund: refund() as never });

    expect(links).toEqual({
      invoiceId: "in_sub",
      paymentIntentId: "pi_1",
      subscriptionId: "sub_9",
    });
  });

  it("returns no links when there is no PaymentIntent at all", async () => {
    stripeMock.charges.retrieve.mockResolvedValue({ payment_intent: null });

    const links = await resolveRiskLinks({
      dispute: dispute({ payment_intent: null }) as never,
      kind: "dispute",
    });

    expect(links).toEqual({ invoiceId: null, paymentIntentId: null, subscriptionId: null });
    expect(stripeMock.invoicePayments.list).not.toHaveBeenCalled();
  });
});

describe("applyRiskEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes a negative entry for a successful refund", async () => {
    const fake = createFakeTx();

    await applyRiskEvent(fake.tx, {
      billingEventId: "be_1",
      canonical: { kind: "refund", refund: refund() as never },
      links: LINKS,
      ownership: OWNERSHIP,
    });

    expect(fake.ledger.get("REFUND_SUCCEEDED:re_1:succeeded")?.amount).toBe(BigInt(-1900));
  });

  it("records a failed refund without removing or replacing anything", async () => {
    const fake = createFakeTx();

    await applyRiskEvent(fake.tx, {
      billingEventId: "be_1",
      canonical: { kind: "refund", refund: refund({ status: "failed" }) as never },
      links: LINKS,
      ownership: OWNERSHIP,
    });

    expect(fake.ledger.get("REFUND_FAILED:re_1:failed")?.amount).toBe(BigInt(0));
    expect(fake.ledger.has("REFUND_SUCCEEDED:re_1:succeeded")).toBe(false);
  });

  it("does not duplicate a replayed refund", async () => {
    const fake = createFakeTx();
    const input = {
      billingEventId: "be_1",
      canonical: { kind: "refund", refund: refund() } as never,
      links: LINKS,
      ownership: OWNERSHIP,
    };

    await applyRiskEvent(fake.tx, input);
    await applyRiskEvent(fake.tx, input);

    expect(fake.ledger.size).toBe(1);
  });

  it("opens a dispute with a negative entry and a critical issue", async () => {
    const fake = createFakeTx();

    await applyRiskEvent(fake.tx, {
      billingEventId: "be_1",
      canonical: { dispute: dispute() as never, kind: "dispute" },
      links: LINKS,
      ownership: OWNERSHIP,
    });

    expect(fake.ledger.get("DISPUTE_OPENED:dp_1:needs_response")?.amount).toBe(BigInt(-1900));
    expect(fake.issues).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ kind: "DISPUTE_OPENED", severity: "CRITICAL" }),
      }),
    );
  });

  it("records won and lost disputes as separate entries without an issue", async () => {
    const fake = createFakeTx();

    await applyRiskEvent(fake.tx, {
      billingEventId: "be_1",
      canonical: { dispute: dispute({ status: "won" }) as never, kind: "dispute" },
      links: LINKS,
      ownership: OWNERSHIP,
    });
    await applyRiskEvent(fake.tx, {
      billingEventId: "be_1",
      canonical: { dispute: dispute({ status: "lost" }) as never, kind: "dispute" },
      links: LINKS,
      ownership: OWNERSHIP,
    });

    expect(fake.ledger.has("DISPUTE_WON:dp_1:won")).toBe(true);
    expect(fake.ledger.has("DISPUTE_LOST:dp_1:lost")).toBe(true);
    expect(fake.issues).not.toHaveBeenCalled();
  });

  it("raises a critical issue for an early fraud warning without a ledger entry", async () => {
    const fake = createFakeTx();

    await applyRiskEvent(fake.tx, {
      billingEventId: "be_1",
      canonical: {
        kind: "early_fraud_warning",
        warning: { charge: "ch_1", created: 1_790_000_000, id: "efw_1" } as never,
      },
      links: LINKS,
      ownership: OWNERSHIP,
    });

    expect(fake.ledger.size).toBe(0);
    expect(fake.issues).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ kind: "EARLY_FRAUD_WARNING", severity: "CRITICAL" }),
      }),
    );
  });

  it("never touches the subscription or the entitlement", async () => {
    const fake = createFakeTx();

    await applyRiskEvent(fake.tx, {
      billingEventId: "be_1",
      canonical: { kind: "refund", refund: refund() as never },
      links: LINKS,
      ownership: OWNERSHIP,
    });

    expect(fake.tx).not.toHaveProperty("billingSubscription");
    expect(fake.tx).not.toHaveProperty("workspaceEntitlement");
  });
});
