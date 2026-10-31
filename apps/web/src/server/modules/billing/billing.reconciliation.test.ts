import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { proPlan } from "./billing.catalog";
import { runStripeReconciliation } from "./billing.reconciliation";

const WORKSPACE_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d";
const NOW = new Date("2026-10-30T04:17:00.000Z");

const dbMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  billingCustomer: { findFirst: vi.fn() },
  billingEvent: { findFirst: vi.fn() },
  billingIssue: { createMany: vi.fn(), updateMany: vi.fn() },
  billingLedgerEntry: { createMany: vi.fn(), findMany: vi.fn() },
  billingReconciliationRun: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  billingSubscription: { findMany: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
  workspaceEntitlement: { updateMany: vi.fn() },
}));

const projectMock = vi.hoisted(() => vi.fn());

const stripeMock = vi.hoisted(() => ({
  invoices: { retrieve: vi.fn() },
  subscriptions: { list: vi.fn(), retrieve: vi.fn() },
  tax: { registrations: { list: vi.fn() } },
}));

vi.mock("@/server/core/db", () => ({ prisma: dbMock }));
vi.mock("./billing.stripe", () => ({ getStripeClient: () => stripeMock }));
vi.mock("./billing.subscriptions", () => ({ projectSubscription: projectMock }));

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    clientVersion: Prisma.prismaVersion.client,
    code: "P2002",
  });
}

function missingResource() {
  return Object.assign(new Error("No such subscription"), { code: "resource_missing" });
}

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
          price: { currency: "usd", id: proPlan().priceId },
          quantity: 2,
        },
      ],
    },
    status: "active",
    ...overrides,
  };
}

function localSubscription(overrides: Record<string, unknown> = {}) {
  return {
    cancelAtPeriodEnd: false,
    currency: "usd",
    currentPeriodEnd: new Date(1_800_000_000 * 1000),
    currentPeriodStart: new Date(1_790_000_000 * 1000),
    quantity: 2,
    stripePriceId: proPlan().priceId,
    stripeStatus: "active",
    stripeSubscriptionId: "sub_1",
    stripeSubscriptionItemId: "si_1",
    workspaceId: WORKSPACE_ID,
    ...overrides,
  };
}

function issueKinds(): Array<string> {
  return dbMock.billingIssue.createMany.mock.calls.flatMap((call) => {
    const data = (call[0] as { data?: Array<{ kind: string }> }).data ?? [];

    return data.map((row) => row.kind);
  });
}

describe("runStripeReconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(dbMock));
    dbMock.billingCustomer.findFirst.mockResolvedValue({ id: "bc_1", workspaceId: WORKSPACE_ID });
    dbMock.billingEvent.findFirst.mockResolvedValue(null);
    dbMock.billingIssue.createMany.mockResolvedValue({ count: 1 });
    dbMock.billingIssue.updateMany.mockResolvedValue({ count: 1 });
    dbMock.billingLedgerEntry.createMany.mockResolvedValue({ count: 1 });
    dbMock.billingLedgerEntry.findMany.mockResolvedValue([]);
    dbMock.billingReconciliationRun.create.mockResolvedValue({ id: "run_1" });
    dbMock.billingReconciliationRun.findFirst.mockResolvedValue(null);
    dbMock.billingReconciliationRun.update.mockResolvedValue({});
    dbMock.billingSubscription.findMany.mockResolvedValue([]);
    dbMock.billingSubscription.findUnique.mockResolvedValue(null);
    dbMock.billingSubscription.updateMany.mockResolvedValue({ count: 1 });
    dbMock.workspaceEntitlement.updateMany.mockResolvedValue({ count: 1 });
    stripeMock.invoices.retrieve.mockReset();
    stripeMock.subscriptions.list.mockReset().mockResolvedValue({ data: [], has_more: false });
    stripeMock.subscriptions.retrieve.mockReset();
    stripeMock.tax.registrations.list
      .mockReset()
      .mockResolvedValue({ data: [{ id: "tax_registration_1" }] });
  });

  it("creates the historical mirror for a subscription missing locally", async () => {
    stripeMock.subscriptions.list.mockResolvedValue({
      data: [subscription()],
      has_more: false,
    });

    const summary = await runStripeReconciliation(NOW);

    expect(summary).toEqual({
      checkedSubscriptions: 1,
      mismatchCount: 1,
      runId: "run_1",
      skipped: false,
    });
    expect(projectMock).toHaveBeenCalledTimes(1);
  });

  it("does not guess a tenant for a subscription without a customer mapping", async () => {
    dbMock.billingCustomer.findFirst.mockResolvedValue(null);
    stripeMock.subscriptions.list.mockResolvedValue({
      data: [subscription()],
      has_more: false,
    });

    const summary = await runStripeReconciliation(NOW);

    expect(summary.mismatchCount).toBe(1);
    expect(projectMock).not.toHaveBeenCalled();
    expect(issueKinds()).toContain("UNOWNED_STRIPE_OBJECT");
  });

  it("repairs a mirror that drifted from Stripe", async () => {
    dbMock.billingSubscription.findUnique.mockResolvedValue(
      localSubscription({ stripeStatus: "past_due" }),
    );
    stripeMock.subscriptions.list.mockResolvedValue({
      data: [subscription({ status: "active" })],
      has_more: false,
    });

    const summary = await runStripeReconciliation(NOW);

    expect(summary.mismatchCount).toBe(1);
    expect(projectMock).toHaveBeenCalledTimes(1);
  });

  it("does not count a matching mirror as a mismatch", async () => {
    dbMock.billingSubscription.findUnique.mockResolvedValue(localSubscription());
    stripeMock.subscriptions.list.mockResolvedValue({
      data: [subscription()],
      has_more: false,
    });

    const summary = await runStripeReconciliation(NOW);

    expect(summary.mismatchCount).toBe(0);
    expect(projectMock).not.toHaveBeenCalled();
  });

  it("fails closed when a local current subscription disappeared from Stripe", async () => {
    dbMock.billingSubscription.findMany.mockResolvedValue([
      { stripeSubscriptionId: "sub_gone", workspaceId: WORKSPACE_ID },
    ]);
    stripeMock.subscriptions.retrieve.mockRejectedValue(missingResource());

    const summary = await runStripeReconciliation(NOW);

    expect(summary.mismatchCount).toBe(1);
    expect(dbMock.billingSubscription.updateMany).toHaveBeenCalledWith({
      data: { needsReview: true, reviewReason: "MISSING_IN_STRIPE" },
      where: { stripeSubscriptionId: "sub_gone" },
    });
    expect(dbMock.workspaceEntitlement.updateMany).toHaveBeenCalledWith({
      data: { accessState: "REVIEW" },
      where: { workspaceId: WORKSPACE_ID },
    });
    expect(issueKinds()).toContain("MISSING_IN_STRIPE");
  });

  it("appends a ledger correction instead of editing the original entry", async () => {
    dbMock.billingLedgerEntry.findMany.mockResolvedValue([
      {
        amount: BigInt(1000),
        currency: "usd",
        id: "le_1",
        stripeObjectId: "in_1",
        workspaceId: WORKSPACE_ID,
      },
    ]);
    stripeMock.invoices.retrieve.mockResolvedValue({
      amount_paid: 1200,
      currency: "usd",
      id: "in_1",
    });

    const summary = await runStripeReconciliation(NOW);

    const [call] = dbMock.billingLedgerEntry.createMany.mock.calls;

    expect(summary.mismatchCount).toBe(1);
    expect(call?.[0]).toMatchObject({
      data: [
        {
          amount: BigInt(200),
          correctsEntryId: "le_1",
          entryKey: "INVOICE_PAID_CORRECTION:in_1:correction:200",
          kind: "INVOICE_PAID_CORRECTION",
        },
      ],
    });
  });

  it("skips a second run on the same day", async () => {
    dbMock.billingReconciliationRun.create.mockRejectedValue(uniqueViolation());

    const summary = await runStripeReconciliation(NOW);

    expect(summary).toEqual({
      checkedSubscriptions: 0,
      mismatchCount: 0,
      runId: null,
      skipped: true,
    });
    expect(stripeMock.subscriptions.list).not.toHaveBeenCalled();
  });

  it("alerts when the previous successful run is older than 26 hours", async () => {
    dbMock.billingReconciliationRun.findFirst.mockResolvedValue({
      finishedAt: new Date(NOW.getTime() - 30 * 60 * 60 * 1000),
    });

    await runStripeReconciliation(NOW);

    expect(issueKinds()).toContain("RECONCILIATION_STALE");
  });

  it("never writes to Stripe", async () => {
    await runStripeReconciliation(NOW);

    expect(stripeMock.subscriptions).not.toHaveProperty("update");
    expect(stripeMock.subscriptions).not.toHaveProperty("create");
    expect(stripeMock.invoices).not.toHaveProperty("update");
  });
});
