import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { purgeBillingEventPayloads } from "@/server/core/billing/purge";

import { proPlan } from "./billing.catalog";
import { NonRetryableBillingError } from "./billing.errors";
import { markEventDeadLetter, processStripeEvent, sweepStaleStripeEvents } from "./billing.events";

const WORKSPACE_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d";
const OTHER_WORKSPACE_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5e";

const stripeMock = vi.hoisted(() => ({
  charges: { retrieve: vi.fn() },
  checkout: { sessions: { retrieve: vi.fn() } },
  disputes: { retrieve: vi.fn() },
  invoices: { retrieve: vi.fn() },
  radar: { earlyFraudWarnings: { retrieve: vi.fn() } },
  refunds: { retrieve: vi.fn() },
  subscriptions: { retrieve: vi.fn() },
}));

const dbMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  billingCheckoutSession: { findFirst: vi.fn(), upsert: vi.fn() },
  billingCustomer: { findFirst: vi.fn() },
  billingEvent: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  billingIssue: { upsert: vi.fn() },
  billingSubscription: { findUnique: vi.fn(), updateMany: vi.fn(), upsert: vi.fn() },
  workspaceEntitlement: { findUnique: vi.fn(), upsert: vi.fn() },
  workspaceMember: { count: vi.fn() },
}));

const triggerMock = vi.hoisted(() => vi.fn());

vi.mock("@/server/core/db", () => ({ prisma: dbMock }));
vi.mock("@trigger.dev/sdk", () => ({ tasks: { trigger: triggerMock } }));
vi.mock("./billing.stripe", () => ({ getStripeClient: () => stripeMock }));

function storedEvent(overrides: Record<string, unknown> = {}) {
  return {
    api_version: "2026-09-30.endive",
    data: { object: { id: "sub_1", object: "subscription", status: "active" } },
    id: "evt_1",
    type: "customer.subscription.updated",
    ...overrides,
  };
}

function eventRow(overrides: Record<string, unknown> = {}) {
  return { id: "be_1", payload: storedEvent(), status: "ENQUEUED", ...overrides };
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

function callArg(mock: ReturnType<typeof vi.fn>, index = 0): Record<string, unknown> {
  const call = mock.mock.calls[index]?.[0] as Record<string, unknown> | undefined;

  expect(call).toBeDefined();

  return call as Record<string, unknown>;
}

describe("stripe event worker", () => {
  beforeEach(() => {
    dbMock.$transaction
      .mockReset()
      .mockImplementation(async (fn: (tx: unknown) => unknown) => fn(dbMock));
    dbMock.billingCheckoutSession.findFirst.mockReset().mockResolvedValue(null);
    dbMock.billingCheckoutSession.upsert.mockReset().mockResolvedValue({});
    dbMock.billingCustomer.findFirst
      .mockReset()
      .mockResolvedValue({ id: "bc_1", workspaceId: WORKSPACE_ID });
    dbMock.billingEvent.findMany.mockReset().mockResolvedValue([]);
    dbMock.billingEvent.findUnique.mockReset().mockResolvedValue(eventRow());
    dbMock.billingEvent.update.mockReset().mockResolvedValue({});
    dbMock.billingEvent.updateMany.mockReset().mockResolvedValue({ count: 0 });
    dbMock.billingIssue.upsert.mockReset().mockResolvedValue({});
    dbMock.billingSubscription.findUnique.mockReset().mockResolvedValue(null);
    dbMock.billingSubscription.updateMany.mockReset().mockResolvedValue({ count: 0 });
    dbMock.billingSubscription.upsert.mockReset().mockResolvedValue({ id: "bs_1" });
    dbMock.workspaceEntitlement.findUnique
      .mockReset()
      .mockResolvedValue({ accessState: "ACTIVE", sourceSubscriptionId: "bs_old" });
    dbMock.workspaceEntitlement.upsert.mockReset().mockResolvedValue({});
    dbMock.workspaceMember.count.mockReset().mockResolvedValue(0);
    triggerMock.mockReset().mockResolvedValue({ id: "run_1" });
    stripeMock.subscriptions.retrieve.mockReset().mockResolvedValue(subscription());
  });

  it("projects the canonical object, not the event snapshot", async () => {
    dbMock.billingSubscription.findUnique.mockResolvedValue({
      activatedAt: new Date("2026-09-01T00:00:00.000Z"),
      graceEndsAt: null,
      stripeStatus: "active",
      workspaceId: WORKSPACE_ID,
    });
    stripeMock.subscriptions.retrieve.mockResolvedValue(subscription({ status: "past_due" }));

    const outcome = await processStripeEvent("be_1");

    const mirror = callArg(dbMock.billingSubscription.upsert);

    expect(outcome).toEqual({ status: "processed" });
    expect(stripeMock.subscriptions.retrieve).toHaveBeenCalledWith("sub_1");
    expect(mirror).toMatchObject({
      create: { stripeStatus: "past_due" },
      update: { stripeStatus: "past_due" },
    });
    expect(callArg(dbMock.workspaceEntitlement.upsert)).toMatchObject({
      update: { accessState: "SUSPENDED", planCode: "PRO", seatLimit: 2 },
    });
  });

  it("stores an unknown subscription status verbatim and moves the entitlement to REVIEW", async () => {
    stripeMock.subscriptions.retrieve.mockResolvedValue(
      subscription({ status: "some_future_status" }),
    );

    const outcome = await processStripeEvent("be_1");

    const mirror = callArg(dbMock.billingSubscription.upsert);

    expect(outcome).toEqual({ status: "processed" });
    expect(mirror).toMatchObject({
      create: { needsReview: true, stripeStatus: "some_future_status" },
    });
    expect(callArg(dbMock.workspaceEntitlement.upsert)).toMatchObject({
      update: { accessState: "REVIEW" },
    });
  });

  it("puts a known workspace into REVIEW when the Stripe customer is unowned", async () => {
    dbMock.billingCustomer.findFirst.mockResolvedValue(null);
    dbMock.billingSubscription.findUnique.mockResolvedValue({ workspaceId: WORKSPACE_ID });

    const outcome = await processStripeEvent("be_1");

    expect(outcome).toEqual({ status: "unowned" });
    expect(dbMock.billingSubscription.upsert).not.toHaveBeenCalled();
    expect(callArg(dbMock.workspaceEntitlement.upsert)).toMatchObject({
      update: { accessState: "REVIEW" },
    });
    expect(callArg(dbMock.billingIssue.upsert)).toMatchObject({
      create: { kind: "UNOWNED_STRIPE_OBJECT", severity: "CRITICAL" },
    });
  });

  it("records an issue without touching any entitlement when the workspace is unknown", async () => {
    dbMock.billingCustomer.findFirst.mockResolvedValue(null);
    dbMock.billingSubscription.findUnique.mockResolvedValue(null);

    const outcome = await processStripeEvent("be_1");

    expect(outcome).toEqual({ status: "unowned" });
    expect(dbMock.workspaceEntitlement.upsert).not.toHaveBeenCalled();
    expect(dbMock.billingIssue.upsert).toHaveBeenCalledTimes(1);
  });

  it("refuses an event produced by another API version without calling Stripe", async () => {
    dbMock.billingEvent.findUnique.mockResolvedValue(
      eventRow({ payload: storedEvent({ api_version: "2024-01-01" }) }),
    );

    await expect(processStripeEvent("be_1")).rejects.toBeInstanceOf(NonRetryableBillingError);
    expect(stripeMock.subscriptions.retrieve).not.toHaveBeenCalled();
  });

  it("refuses a subscription that already belongs to another workspace", async () => {
    dbMock.billingSubscription.findUnique.mockResolvedValue({ workspaceId: OTHER_WORKSPACE_ID });

    await expect(processStripeEvent("be_1")).rejects.toMatchObject({ code: "OWNER_MISMATCH" });
    expect(dbMock.billingSubscription.upsert).not.toHaveBeenCalled();
  });

  it("skips an event that is already processed", async () => {
    dbMock.billingEvent.findUnique.mockResolvedValue(eventRow({ status: "PROCESSED" }));

    await expect(processStripeEvent("be_1")).resolves.toEqual({ status: "skipped" });
    expect(stripeMock.subscriptions.retrieve).not.toHaveBeenCalled();
  });

  it("does not grant access from a completed checkout session", async () => {
    dbMock.billingEvent.findUnique.mockResolvedValue(
      eventRow({
        payload: storedEvent({
          data: { object: { id: "cs_1", object: "checkout.session" } },
          type: "checkout.session.completed",
        }),
      }),
    );
    stripeMock.checkout.sessions.retrieve.mockResolvedValue({
      customer: "cus_1",
      id: "cs_1",
      status: "complete",
    });

    const outcome = await processStripeEvent("be_1");

    expect(outcome).toEqual({ status: "processed" });
    expect(callArg(dbMock.billingCheckoutSession.upsert)).toMatchObject({
      create: { stripeStatus: "complete", workspaceId: WORKSPACE_ID },
    });
    expect(dbMock.workspaceEntitlement.upsert).not.toHaveBeenCalled();
  });

  it("marks a failed event as DEAD_LETTER with a critical issue", async () => {
    dbMock.billingEvent.findUnique.mockResolvedValue({
      stripeEventId: "evt_1",
      type: "customer.subscription.updated",
    });

    await markEventDeadLetter("be_1", new Error("boom"));

    expect(dbMock.billingEvent.update).toHaveBeenCalledWith({
      data: { lastError: "boom", status: "DEAD_LETTER" },
      where: { id: "be_1" },
    });
    expect(callArg(dbMock.billingIssue.upsert)).toMatchObject({
      create: { kind: "EVENT_DEAD_LETTER", severity: "CRITICAL" },
    });
  });

  it("requeues a stale event under a replay key", async () => {
    dbMock.billingEvent.findMany.mockResolvedValue([
      { id: "be_1", replayCount: 2, stripeEventId: "evt_1" },
    ]);

    const result = await sweepStaleStripeEvents(new Date("2026-10-30T12:00:00.000Z"));

    expect(result).toEqual({ requeued: 1 });
    expect(dbMock.billingEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: { in: ["RECEIVED", "PROCESSING"] },
          updatedAt: { lt: expect.any(Date) },
        },
      }),
    );
    expect(triggerMock).toHaveBeenCalledWith(
      "billing-process-stripe-event",
      { billingEventId: "be_1" },
      { idempotencyKey: "evt_1:replay:3" },
    );
    expect(callArg(dbMock.billingEvent.update)).toMatchObject({
      data: { replayCount: { increment: 1 }, status: "ENQUEUED" },
    });
  });

  it("never sweeps processed events", async () => {
    await sweepStaleStripeEvents();

    expect(dbMock.billingEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["RECEIVED", "PROCESSING"] },
        }),
      }),
    );
    expect(triggerMock).not.toHaveBeenCalled();
  });

  it("purges an old payload without deleting the event id", async () => {
    dbMock.billingEvent.updateMany.mockResolvedValue({ count: 3 });

    const purged = await purgeBillingEventPayloads(
      dbMock as never,
      new Date("2026-10-30T00:00:00.000Z"),
    );

    expect(purged).toBe(3);
    expect(dbMock.billingEvent.updateMany).toHaveBeenCalledWith({
      data: { payload: Prisma.DbNull },
      where: {
        payload: { not: Prisma.DbNull },
        receivedAt: { lt: expect.any(Date) },
      },
    });
    expect(dbMock.billingEvent).not.toHaveProperty("deleteMany");
  });
});
