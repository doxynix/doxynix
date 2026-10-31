import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DbClient } from "@/server/core/db";

import { proPlan } from "./billing.catalog";
import { applyInvoiceEvent, GRACE_PERIOD_MS } from "./billing.invoices";

const WORKSPACE_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d";
const CUSTOMER_ID = "cus_1";
const SUBSCRIPTION_ID = "sub_1";
const NOW = new Date("2026-10-30T12:00:00.000Z");
const FAILED_AT = new Date("2026-10-28T09:00:00.000Z");

const stripeMock = vi.hoisted(() => ({ subscriptions: { retrieve: vi.fn() } }));

vi.mock("./billing.stripe", () => ({ getStripeClient: () => stripeMock }));

type Mirror = {
  activatedAt: Date | null;
  graceEndsAt: Date | null;
  pastDueStartedAt: Date | null;
  stripeStatus: string;
};

type LedgerRow = { amount: bigint; entryKey: string; kind: string };

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    cancel_at: null,
    cancel_at_period_end: false,
    customer: CUSTOMER_ID,
    id: SUBSCRIPTION_ID,
    items: {
      data: [
        {
          current_period_end: 1_800_000_000,
          current_period_start: 1_790_000_000,
          id: "si_1",
          price: { currency: "usd", id: proPlan().priceId, recurring: { interval: "month" } },
          quantity: 2,
        },
      ],
    },
    latest_invoice: "in_1",
    status: "active",
    ...overrides,
  };
}

function invoice(overrides: Record<string, unknown> = {}) {
  return {
    amount_paid: 1900,
    currency: "usd",
    id: "in_1",
    parent: {
      subscription_details: { subscription: SUBSCRIPTION_ID },
      type: "subscription_details",
    },
    status_transitions: { paid_at: Math.floor(NOW.getTime() / 1000) },
    ...overrides,
  };
}

function createFakeTx(initial: Partial<Mirror> = {}) {
  const mirror: Mirror = {
    activatedAt: null,
    graceEndsAt: null,
    pastDueStartedAt: null,
    stripeStatus: "active",
    ...initial,
  };
  const ledger = new Map<string, LedgerRow>();
  const entitlementUpdates: Array<Record<string, unknown>> = [];
  const mirrorUpdates: Array<Record<string, unknown>> = [];

  const tx = {
    billingIssue: {
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    billingLedgerEntry: {
      createMany: vi.fn(async ({ data }: { data: Array<LedgerRow> }) => {
        let count = 0;

        for (const row of data) {
          if (!ledger.has(row.entryKey)) {
            ledger.set(row.entryKey, row);
            count += 1;
          }
        }

        return { count };
      }),
    },
    billingSubscription: {
      findUnique: vi.fn(async () => ({ ...mirror })),
      updateMany: vi.fn(
        async ({
          data,
          where,
        }: {
          data: Record<string, unknown>;
          where: { activatedAt?: null | Date; isCurrent?: boolean };
        }) => {
          mirrorUpdates.push(data);

          if (where.activatedAt === null) {
            if (mirror.activatedAt != null) {
              return { count: 0 };
            }

            mirror.activatedAt = data.activatedAt as Date;

            return { count: 1 };
          }

          if ("graceEndsAt" in data) {
            mirror.graceEndsAt = data.graceEndsAt as Date | null;
            mirror.pastDueStartedAt = data.pastDueStartedAt as Date | null;
          }

          return { count: 1 };
        },
      ),
      upsert: vi.fn(async ({ create }: { create: Record<string, unknown> }) => {
        mirror.stripeStatus = create.stripeStatus as string;

        return { id: "bs_1" };
      }),
    },
    workspaceEntitlement: {
      findUnique: vi.fn(async () => ({
        accessState: "ACTIVE",
        sourceSubscriptionId: "bs_1",
      })),
      upsert: vi.fn(async ({ update }: { update: Record<string, unknown> }) => {
        entitlementUpdates.push(update);

        return {};
      }),
    },
    workspaceMember: { count: vi.fn().mockResolvedValue(1) },
  };

  return {
    entitlementUpdates,
    ledger,
    mirror,
    mirrorUpdates,
    tx: tx as unknown as DbClient,
  };
}

function paidInput(overrides: Record<string, unknown> = {}) {
  return {
    billingEventId: "be_1",
    eventCreatedAt: NOW,
    eventType: "invoice.paid",
    invoice: invoice() as never,
    now: NOW,
    ownership: { billingCustomerId: "bc_1", customerId: CUSTOMER_ID, workspaceId: WORKSPACE_ID },
    subscription: subscription() as never,
    ...overrides,
  };
}

describe("invoice.paid", () => {
  beforeEach(() => {
    stripeMock.subscriptions.retrieve.mockReset().mockResolvedValue(subscription());
  });

  it("activates the subscription exactly once", async () => {
    const fake = createFakeTx();
    const firstPaidAt = new Date("2026-10-01T10:00:00.000Z");
    const secondPaidAt = new Date("2026-10-25T10:00:00.000Z");

    await applyInvoiceEvent(
      fake.tx,
      paidInput({
        invoice: invoice({
          id: "in_first",
          status_transitions: { paid_at: Math.floor(firstPaidAt.getTime() / 1000) },
        }),
      }),
    );
    await applyInvoiceEvent(
      fake.tx,
      paidInput({
        invoice: invoice({
          id: "in_second",
          status_transitions: { paid_at: Math.floor(secondPaidAt.getTime() / 1000) },
        }),
      }),
    );

    expect(fake.mirror.activatedAt).toEqual(firstPaidAt);
  });

  it("writes one ledger entry per invoice even when the event is replayed", async () => {
    const fake = createFakeTx();

    await applyInvoiceEvent(fake.tx, paidInput());
    await applyInvoiceEvent(fake.tx, paidInput());

    expect(fake.ledger.size).toBe(1);
    expect(fake.ledger.get("INVOICE_PAID:in_1:paid")?.amount).toBe(BigInt(1900));
  });

  it("clears grace when the canonical subscription is active again", async () => {
    const fake = createFakeTx({ graceEndsAt: new Date("2026-11-01T00:00:00.000Z") });

    await applyInvoiceEvent(fake.tx, paidInput({ invoice: invoice({ id: "in_recovery" }) }));

    expect(fake.mirrorUpdates).toContainEqual({ graceEndsAt: null, pastDueStartedAt: null });
    expect(fake.entitlementUpdates.at(-1)).toMatchObject({ accessState: "ACTIVE" });
  });

  it("only writes the ledger when the invoice is not subscription-backed", async () => {
    const fake = createFakeTx();

    await applyInvoiceEvent(
      fake.tx,
      paidInput({
        invoice: invoice({ id: "in_one_off", parent: null }),
      }),
    );

    expect(fake.ledger.size).toBe(1);
    expect(fake.mirror.activatedAt).toBeNull();
    expect(stripeMock.subscriptions.retrieve).not.toHaveBeenCalled();
  });
});

describe("invoice.payment_failed", () => {
  beforeEach(() => {
    stripeMock.subscriptions.retrieve
      .mockReset()
      .mockResolvedValue(subscription({ status: "past_due" }));
  });

  it("opens the grace window on the first failure only", async () => {
    const fake = createFakeTx({ activatedAt: new Date("2026-09-01T00:00:00.000Z") });

    await applyInvoiceEvent(
      fake.tx,
      paidInput({
        eventCreatedAt: FAILED_AT,
        eventType: "invoice.payment_failed",
        now: FAILED_AT,
        subscription: subscription({ status: "past_due" }),
      }),
    );
    const graceAfterFirst = fake.mirror.graceEndsAt;

    await applyInvoiceEvent(
      fake.tx,
      paidInput({
        eventCreatedAt: new Date(FAILED_AT.getTime() + 24 * 60 * 60 * 1000),
        eventType: "invoice.payment_failed",
        now: new Date(FAILED_AT.getTime() + 24 * 60 * 60 * 1000),
        subscription: subscription({ status: "past_due" }),
      }),
    );

    expect(graceAfterFirst).toEqual(new Date(FAILED_AT.getTime() + GRACE_PERIOD_MS));
    expect(fake.mirror.graceEndsAt).toEqual(graceAfterFirst);
    expect(fake.mirror.pastDueStartedAt).toEqual(FAILED_AT);
  });

  it("denies access exactly at graceEndsAt", async () => {
    const fake = createFakeTx({ activatedAt: new Date("2026-09-01T00:00:00.000Z") });
    const graceEndsAt = new Date(FAILED_AT.getTime() + GRACE_PERIOD_MS);

    await applyInvoiceEvent(
      fake.tx,
      paidInput({
        eventCreatedAt: FAILED_AT,
        eventType: "invoice.payment_failed",
        now: graceEndsAt,
        subscription: subscription({ status: "past_due" }),
      }),
    );

    expect(fake.entitlementUpdates.at(-1)).toMatchObject({ accessState: "SUSPENDED" });
  });

  it("grants grace inside the window", async () => {
    const fake = createFakeTx({ activatedAt: new Date("2026-09-01T00:00:00.000Z") });
    const insideGrace = new Date(FAILED_AT.getTime() + 24 * 60 * 60 * 1000);

    await applyInvoiceEvent(
      fake.tx,
      paidInput({
        eventCreatedAt: FAILED_AT,
        eventType: "invoice.payment_failed",
        now: insideGrace,
        subscription: subscription({ status: "past_due" }),
      }),
    );

    expect(fake.entitlementUpdates.at(-1)).toMatchObject({ accessState: "GRACE" });
  });
});
