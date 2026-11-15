import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { proPlan } from "./billing.catalog";
import { runStripeReconciliation } from "./billing.reconciliation";
import type * as BillingSubscriptions from "./billing.subscriptions";

const WORKSPACE_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d";
const NOW = new Date("2026-10-30T04:17:00.000Z");

const dbMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  billingCustomer: { findFirst: vi.fn(), findMany: vi.fn() },
  billingEvent: { findFirst: vi.fn() },
  billingIssue: { createMany: vi.fn(), updateMany: vi.fn() },
  billingLedgerEntry: { createMany: vi.fn(), findMany: vi.fn() },
  billingReconciliationRun: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  billingSubscription: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
  },
  workspaceEntitlement: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
  },
  workspaceMember: { count: vi.fn(), groupBy: vi.fn() },
}));

const projectMock = vi.hoisted(() => vi.fn());
const seatSyncMock = vi.hoisted(() => vi.fn());

const stripeMock = vi.hoisted(() => ({
  invoices: { retrieve: vi.fn() },
  subscriptions: { list: vi.fn(), retrieve: vi.fn() },
  tax: { registrations: { list: vi.fn() }, settings: { retrieve: vi.fn() } },
}));

vi.mock("@/server/core/db", () => ({ prisma: dbMock }));
vi.mock("@/server/core/billing/seat-sync", () => ({ syncWorkspaceSeats: seatSyncMock }));
vi.mock("@/server/core/billing/stripe-client", () => ({ getStripeClient: () => stripeMock }));
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
          price: { currency: "usd", id: proPlan().priceId, recurring: { interval: "month" } },
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
    externalPriceId: proPlan().priceId,
    externalStatus: "active",
    externalSubscriptionId: "sub_1",
    externalSubscriptionItemId: "si_1",
    id: "bs_1",
    isCurrent: true,
    quantity: 2,
    workspaceId: WORKSPACE_ID,
    ...overrides,
  };
}

function entitlement(overrides: Record<string, unknown> = {}) {
  return {
    aiTokensPerMonth: 20_000_000,
    analysesPerMonth: 500,
    autoResync: true,
    historyDays: 90,
    planCode: "PRO",
    privateReposAllowed: true,
    prReviews: true,
    reposLimit: null,
    sourceSubscriptionId: "bs_1",
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
    dbMock.billingCustomer.findMany.mockResolvedValue([
      { externalCustomerId: "cus_1", id: "bc_1", workspaceId: WORKSPACE_ID },
    ]);
    dbMock.billingEvent.findFirst.mockResolvedValue(null);
    dbMock.billingIssue.createMany.mockResolvedValue({ count: 1 });
    dbMock.billingIssue.updateMany.mockResolvedValue({ count: 1 });
    dbMock.billingLedgerEntry.createMany.mockResolvedValue({ count: 1 });
    dbMock.billingLedgerEntry.findMany.mockResolvedValue([]);
    dbMock.billingReconciliationRun.create.mockResolvedValue({ id: "run_1" });
    dbMock.billingReconciliationRun.findFirst.mockResolvedValue(null);
    dbMock.billingReconciliationRun.update.mockResolvedValue({});
    dbMock.billingSubscription.findFirst.mockResolvedValue(null);
    dbMock.billingSubscription.findMany.mockResolvedValue([]);
    dbMock.billingSubscription.findUnique.mockResolvedValue(null);
    dbMock.billingSubscription.updateMany.mockResolvedValue({ count: 1 });
    dbMock.billingSubscription.upsert.mockResolvedValue({ id: "bs_1" });
    dbMock.workspaceEntitlement.updateMany.mockResolvedValue({ count: 1 });
    dbMock.workspaceEntitlement.findMany.mockResolvedValue([entitlement()]);
    dbMock.workspaceEntitlement.findUnique.mockResolvedValue(entitlement());
    dbMock.workspaceEntitlement.upsert.mockResolvedValue({});
    dbMock.workspaceMember.count.mockResolvedValue(2);
    dbMock.workspaceMember.groupBy.mockResolvedValue([
      { _count: { _all: 2 }, workspaceId: WORKSPACE_ID },
    ]);
    projectMock.mockReset().mockResolvedValue({
      accessState: "ACTIVE",
      mirrorId: "bs_1",
      ownsAccess: true,
      reviewReason: null,
    });
    seatSyncMock.mockReset().mockResolvedValue({ quantity: 2, synced: true });
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
    dbMock.billingCustomer.findMany.mockResolvedValue([]);
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
    dbMock.billingSubscription.findMany.mockResolvedValue([
      localSubscription({ externalStatus: "past_due" }),
    ]);
    stripeMock.subscriptions.list.mockResolvedValue({
      data: [subscription({ status: "active" })],
      has_more: false,
    });

    const summary = await runStripeReconciliation(NOW);

    expect(summary.mismatchCount).toBe(1);
    expect(projectMock).toHaveBeenCalledTimes(1);
  });

  it("repairs seats that drifted from the membership count", async () => {
    dbMock.billingSubscription.findMany.mockResolvedValue([localSubscription()]);
    dbMock.workspaceMember.groupBy.mockResolvedValue([
      { _count: { _all: 3 }, workspaceId: WORKSPACE_ID },
    ]);
    stripeMock.subscriptions.list.mockResolvedValue({
      data: [subscription()],
      has_more: false,
    });

    const summary = await runStripeReconciliation(NOW);

    expect(summary.mismatchCount).toBe(1);
    expect(seatSyncMock).toHaveBeenCalledWith({
      requestId: expect.stringContaining("reconcile:sub_"),
      workspaceId: WORKSPACE_ID,
    });
  });

  it("repairs a stale mirror and the seat quantity in one run", async () => {
    dbMock.billingSubscription.findMany.mockResolvedValue([
      localSubscription({ externalStatus: "past_due" }),
    ]);
    dbMock.workspaceMember.groupBy.mockResolvedValue([
      { _count: { _all: 3 }, workspaceId: WORKSPACE_ID },
    ]);
    stripeMock.subscriptions.list.mockResolvedValue({
      data: [subscription({ status: "active" })],
      has_more: false,
    });

    const summary = await runStripeReconciliation(NOW);

    expect(summary.mismatchCount).toBe(1);
    expect(projectMock).toHaveBeenCalledTimes(1);
    expect(seatSyncMock).toHaveBeenCalled();
  });

  it("recomputes a workspace stuck in review even when the mirror matches", async () => {
    dbMock.billingSubscription.findMany.mockResolvedValue([
      localSubscription({ needsReview: true }),
    ]);
    stripeMock.subscriptions.list.mockResolvedValue({
      data: [subscription()],
      has_more: false,
    });

    const summary = await runStripeReconciliation(NOW);

    expect(projectMock).toHaveBeenCalledTimes(1);
    expect(summary.mismatchCount).toBe(1);
  });

  it("repairs stale plan limits even when the mirror matches", async () => {
    dbMock.billingSubscription.findMany.mockResolvedValue([localSubscription()]);
    dbMock.workspaceEntitlement.findMany.mockResolvedValue([
      entitlement({
        aiTokensPerMonth: 1_000_000,
        analysesPerMonth: 20,
        autoResync: false,
        historyDays: 7,
        privateReposAllowed: false,
        prReviews: false,
      }),
    ]);
    stripeMock.subscriptions.list.mockResolvedValue({
      data: [subscription()],
      has_more: false,
    });

    const summary = await runStripeReconciliation(NOW);

    expect(summary.mismatchCount).toBe(1);
    expect(projectMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes a historical mirror and keeps the live entitlement untouched", async () => {
    dbMock.billingSubscription.findMany.mockResolvedValue([
      localSubscription({ externalStatus: "active", isCurrent: null }),
    ]);
    dbMock.workspaceEntitlement.findMany.mockResolvedValue([
      entitlement({ sourceSubscriptionId: "bs_current_other" }),
    ]);
    projectMock.mockResolvedValue({
      accessState: "ACTIVE",
      mirrorId: "bs_historical",
      ownsAccess: false,
      reviewReason: null,
    });
    stripeMock.subscriptions.list.mockResolvedValue({
      data: [subscription({ status: "canceled" })],
      has_more: false,
    });

    const summary = await runStripeReconciliation(NOW);

    expect(summary.mismatchCount).toBe(1);
    expect(projectMock).toHaveBeenCalledTimes(1);
    expect(dbMock.workspaceEntitlement.upsert).not.toHaveBeenCalled();
    expect(seatSyncMock).not.toHaveBeenCalled();
  });

  it("mirrors a live subscription when the current slot is occupied", async () => {
    dbMock.billingSubscription.findFirst.mockResolvedValue({
      externalStatus: "active",
      externalSubscriptionId: "sub_current",
    });
    projectMock.mockResolvedValue({
      accessState: "ACTIVE",
      mirrorId: "bs_duplicate",
      ownsAccess: false,
      reviewReason: null,
    });
    stripeMock.subscriptions.list.mockResolvedValue({
      data: [subscription({ id: "sub_duplicate" })],
      has_more: false,
    });

    const summary = await runStripeReconciliation(NOW);

    expect(summary.mismatchCount).toBe(1);
    expect(projectMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ allowCurrentTakeover: false }),
    );
  });

  it("does not evict a current subscription whose mirror lies about cancellation", async () => {
    dbMock.billingSubscription.findMany.mockResolvedValue([
      localSubscription({ externalSubscriptionId: "sub_duplicate", isCurrent: null }),
    ]);
    dbMock.workspaceEntitlement.findMany.mockResolvedValue([
      entitlement({ sourceSubscriptionId: "bs_current" }),
    ]);
    dbMock.billingSubscription.findFirst.mockResolvedValue({
      externalStatus: "canceled",
      externalSubscriptionId: "sub_current",
    });
    stripeMock.subscriptions.retrieve.mockResolvedValue({ status: "active" });
    stripeMock.subscriptions.list.mockResolvedValue({
      data: [subscription({ id: "sub_duplicate" })],
      has_more: false,
    });

    const summary = await runStripeReconciliation(NOW);

    expect(stripeMock.subscriptions.retrieve).toHaveBeenCalledWith("sub_current");
    expect(summary.mismatchCount).toBe(0);
    expect(projectMock).not.toHaveBeenCalled();
  });

  it("lets a live subscription take the slot once Stripe confirms the current is terminal", async () => {
    dbMock.billingSubscription.findMany.mockResolvedValue([
      localSubscription({ externalSubscriptionId: "sub_new", isCurrent: null, quantity: 2 }),
    ]);
    dbMock.workspaceEntitlement.findMany.mockResolvedValue([
      entitlement({ sourceSubscriptionId: "bs_canceled" }),
    ]);
    dbMock.billingSubscription.findFirst.mockResolvedValue({
      externalStatus: "canceled",
      externalSubscriptionId: "sub_canceled",
    });
    stripeMock.subscriptions.retrieve.mockResolvedValue({ status: "canceled" });
    stripeMock.subscriptions.list.mockResolvedValue({
      data: [subscription({ id: "sub_new" })],
      has_more: false,
    });

    const summary = await runStripeReconciliation(NOW);

    expect(stripeMock.subscriptions.retrieve).toHaveBeenCalledWith("sub_canceled");
    expect(summary.mismatchCount).toBe(1);
    expect(projectMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ allowCurrentTakeover: true }),
    );
  });

  it("gives a live subscription the slot once the previous holder is gone", async () => {
    dbMock.billingSubscription.findMany.mockResolvedValue([
      localSubscription({ externalSubscriptionId: "sub_new", isCurrent: null, quantity: 2 }),
    ]);
    dbMock.workspaceEntitlement.findMany.mockResolvedValue([
      entitlement({ sourceSubscriptionId: "bs_canceled" }),
    ]);
    stripeMock.subscriptions.list.mockResolvedValue({
      data: [subscription({ id: "sub_new" })],
      has_more: false,
    });

    const summary = await runStripeReconciliation(NOW);

    expect(summary.mismatchCount).toBe(1);
    expect(projectMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ allowCurrentTakeover: false }),
    );
  });

  it("does not count a matching mirror as a mismatch", async () => {
    dbMock.billingSubscription.findMany.mockResolvedValue([localSubscription()]);
    stripeMock.subscriptions.list.mockResolvedValue({
      data: [subscription()],
      has_more: false,
    });

    const summary = await runStripeReconciliation(NOW);

    expect(summary.mismatchCount).toBe(0);
    expect(projectMock).not.toHaveBeenCalled();
  });

  it("prefetches the page lookups once instead of per subscription", async () => {
    stripeMock.subscriptions.list.mockResolvedValue({
      data: [subscription(), subscription({ customer: "cus_2", id: "sub_2" })],
      has_more: false,
    });
    dbMock.billingCustomer.findMany.mockResolvedValue([
      { externalCustomerId: "cus_1", id: "bc_1", workspaceId: WORKSPACE_ID },
      { externalCustomerId: "cus_2", id: "bc_2", workspaceId: WORKSPACE_ID },
    ]);
    dbMock.billingSubscription.findMany.mockResolvedValue([
      localSubscription(),
      localSubscription({ externalSubscriptionId: "sub_2", id: "bs_2" }),
    ]);

    const summary = await runStripeReconciliation(NOW);

    expect(dbMock.billingCustomer.findMany).toHaveBeenCalledTimes(1);
    expect(dbMock.billingCustomer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { externalCustomerId: { in: ["cus_1", "cus_2"] }, provider: "stripe" },
      }),
    );
    expect(dbMock.billingSubscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { externalSubscriptionId: { in: ["sub_1", "sub_2"] } },
      }),
    );
    expect(dbMock.workspaceEntitlement.findMany).toHaveBeenCalledTimes(1);
    expect(dbMock.workspaceMember.groupBy).toHaveBeenCalledTimes(1);
    expect(dbMock.billingCustomer.findFirst).not.toHaveBeenCalled();
    expect(dbMock.billingSubscription.findUnique).not.toHaveBeenCalled();
    expect(dbMock.workspaceEntitlement.findUnique).not.toHaveBeenCalled();
    expect(dbMock.workspaceMember.count).not.toHaveBeenCalled();
    expect(summary.mismatchCount).toBe(0);
  });

  it("falls back to a query for rows that appeared after the prefetch", async () => {
    stripeMock.subscriptions.list.mockResolvedValue({
      data: [subscription()],
      has_more: false,
    });
    dbMock.billingSubscription.findMany.mockResolvedValue([]);
    dbMock.billingSubscription.findUnique.mockResolvedValue(localSubscription());

    const summary = await runStripeReconciliation(NOW);

    expect(dbMock.billingSubscription.findUnique).toHaveBeenCalledWith({
      where: { externalSubscriptionId: "sub_1" },
    });
    expect(summary.mismatchCount).toBe(0);
  });

  it("does not re-query a customer mapping the page already found missing", async () => {
    stripeMock.subscriptions.list.mockResolvedValue({
      data: [subscription(), subscription({ id: "sub_2" })],
      has_more: false,
    });
    dbMock.billingCustomer.findMany.mockResolvedValue([]);

    const summary = await runStripeReconciliation(NOW);

    expect(dbMock.billingCustomer.findFirst).not.toHaveBeenCalled();
    expect(issueKinds().filter((kind) => kind === "UNOWNED_STRIPE_OBJECT")).toHaveLength(2);
    expect(summary.mismatchCount).toBe(2);
  });

  it("falls back to a query for an entitlement the page did not prefetch", async () => {
    stripeMock.subscriptions.list.mockResolvedValue({
      data: [
        subscription({
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
                quantity: 1,
              },
            ],
          },
        }),
      ],
      has_more: false,
    });
    dbMock.billingSubscription.findMany.mockResolvedValue([
      localSubscription({ externalSubscriptionItemId: "si_1", quantity: 1 }),
    ]);
    dbMock.workspaceEntitlement.findMany.mockResolvedValue([]);
    dbMock.workspaceMember.groupBy.mockResolvedValue([]);
    dbMock.workspaceEntitlement.findUnique.mockResolvedValue(entitlement());

    const summary = await runStripeReconciliation(NOW);

    expect(dbMock.workspaceEntitlement.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId: WORKSPACE_ID } }),
    );
    // `groupBy` does not report workspaces without members, so 0 must be seeded, not queried.
    expect(dbMock.workspaceMember.count).not.toHaveBeenCalled();
    expect(summary.mismatchCount).toBe(0);
  });

  it("prefetches once per Stripe page, not once per run", async () => {
    stripeMock.subscriptions.list
      .mockResolvedValueOnce({ data: [subscription()], has_more: true })
      .mockResolvedValueOnce({
        data: [subscription({ customer: "cus_2", id: "sub_2" })],
        has_more: false,
      });
    dbMock.billingCustomer.findMany
      .mockResolvedValueOnce([
        { externalCustomerId: "cus_1", id: "bc_1", workspaceId: WORKSPACE_ID },
      ])
      .mockResolvedValueOnce([
        { externalCustomerId: "cus_2", id: "bc_2", workspaceId: WORKSPACE_ID },
      ]);
    dbMock.billingSubscription.findMany
      .mockResolvedValueOnce([localSubscription()])
      .mockResolvedValueOnce([localSubscription({ externalSubscriptionId: "sub_2", id: "bs_2" })])
      .mockResolvedValueOnce([]);

    const summary = await runStripeReconciliation(NOW);

    expect(dbMock.billingCustomer.findMany).toHaveBeenCalledTimes(2);
    expect(dbMock.billingCustomer.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { externalCustomerId: { in: ["cus_1"] }, provider: "stripe" },
    });
    expect(dbMock.billingCustomer.findMany.mock.calls[1]?.[0]).toMatchObject({
      where: { externalCustomerId: { in: ["cus_2"] }, provider: "stripe" },
    });
    expect(dbMock.workspaceMember.groupBy).toHaveBeenCalledTimes(2);
    expect(summary.checkedSubscriptions).toBe(2);
    expect(summary.mismatchCount).toBe(0);
  });

  it("re-reads the workspace after a takeover instead of trusting the page prefetch", async () => {
    const item = {
      current_period_end: 1_800_000_000,
      current_period_start: 1_790_000_000,
      price: { currency: "usd", id: proPlan().priceId, recurring: { interval: "month" } },
      quantity: 2,
    };

    stripeMock.subscriptions.list.mockResolvedValue({
      data: [
        subscription({ id: "sub_new", items: { data: [{ ...item, id: "si_new" }] } }),
        subscription({
          id: "sub_prev",
          items: { data: [{ ...item, id: "si_prev" }] },
          status: "canceled",
        }),
      ],
      has_more: false,
    });
    // Before the run the previous subscription holds the slot, on HOBBY limits.
    dbMock.billingSubscription.findMany.mockResolvedValue([
      localSubscription({
        externalSubscriptionId: "sub_new",
        externalSubscriptionItemId: "si_new",
        id: "bs_new",
        isCurrent: null,
      }),
      localSubscription({
        externalStatus: "canceled",
        externalSubscriptionId: "sub_prev",
        externalSubscriptionItemId: "si_prev",
        id: "bs_prev",
      }),
    ]);
    dbMock.workspaceEntitlement.findMany.mockResolvedValue([
      entitlement({
        aiTokensPerMonth: 1_000_000,
        analysesPerMonth: 20,
        autoResync: false,
        historyDays: 7,
        privateReposAllowed: false,
        prReviews: false,
        sourceSubscriptionId: "bs_prev",
      }),
    ]);
    dbMock.billingSubscription.findFirst
      .mockResolvedValueOnce({ externalStatus: "canceled", externalSubscriptionId: "sub_prev" })
      .mockResolvedValueOnce(null);
    stripeMock.subscriptions.retrieve.mockResolvedValue({ status: "canceled" });
    // After the takeover: the new subscription owns the entitlement, the old one is history.
    dbMock.billingSubscription.findUnique.mockResolvedValue(
      localSubscription({
        externalStatus: "canceled",
        externalSubscriptionId: "sub_prev",
        externalSubscriptionItemId: "si_prev",
        id: "bs_prev",
        isCurrent: null,
      }),
    );
    dbMock.workspaceEntitlement.findUnique.mockResolvedValue(
      entitlement({ sourceSubscriptionId: "bs_new" }),
    );

    const summary = await runStripeReconciliation(NOW);

    expect(dbMock.workspaceEntitlement.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId: WORKSPACE_ID } }),
    );
    expect(dbMock.billingSubscription.findUnique).toHaveBeenCalledWith({
      where: { externalSubscriptionId: "sub_prev" },
    });
    expect(projectMock).toHaveBeenCalledTimes(1);
    expect(projectMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ allowCurrentTakeover: true }),
    );
    expect(summary.mismatchCount).toBe(1);
  });

  it("fails closed when a local current subscription disappeared from Stripe", async () => {
    dbMock.billingSubscription.findMany.mockResolvedValue([
      { externalSubscriptionId: "sub_gone", workspaceId: WORKSPACE_ID },
    ]);
    stripeMock.subscriptions.retrieve.mockRejectedValue(missingResource());

    const summary = await runStripeReconciliation(NOW);

    expect(summary.mismatchCount).toBe(1);
    expect(dbMock.billingSubscription.updateMany).toHaveBeenCalledWith({
      data: { needsReview: true, reviewReason: "MISSING_IN_STRIPE" },
      where: { externalSubscriptionId: "sub_gone" },
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
        externalObjectId: "in_1",
        id: "le_1",
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

  it("repairs with an expanded paid invoice and activates the subscription", async () => {
    const actual = await vi.importActual<typeof BillingSubscriptions>("./billing.subscriptions");
    projectMock.mockImplementationOnce(actual.projectSubscription);

    const paidAt = new Date("2026-10-20T10:00:00.000Z");
    stripeMock.subscriptions.list.mockResolvedValue({
      data: [
        subscription({
          latest_invoice: {
            status: "paid",
            status_transitions: { paid_at: Math.floor(paidAt.getTime() / 1000) },
          },
        }),
      ],
      has_more: false,
    });
    dbMock.billingSubscription.upsert.mockResolvedValue({ id: "bs_1" });

    await runStripeReconciliation(NOW);

    expect(stripeMock.subscriptions.list).toHaveBeenCalledWith(
      expect.objectContaining({ expand: ["data.latest_invoice"] }),
    );
    expect(dbMock.billingSubscription.updateMany).toHaveBeenCalledWith({
      data: { activatedAt: paidAt },
      where: { activatedAt: null, externalSubscriptionId: "sub_1" },
    });
    expect(dbMock.workspaceEntitlement.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ accessState: "ACTIVE" }),
      }),
    );
  });
});
