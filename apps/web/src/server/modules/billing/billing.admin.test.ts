import { readFileSync } from "node:fs";

import { join } from "pathe";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DbClient } from "@/server/core/db";

import { listBillingIssues, replayBillingEvent, resolveBillingIssue } from "./billing.admin";

const EVENT_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d";
const ISSUE_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5e";
const WORKSPACE_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5f";

const triggerMock = vi.hoisted(() => vi.fn());
const metricMock = vi.hoisted(() => vi.fn());
const alertMock = vi.hoisted(() => vi.fn());
const projectMock = vi.hoisted(() => vi.fn());
const stripeMock = vi.hoisted(() => ({ subscriptions: { retrieve: vi.fn() } }));

vi.mock("@trigger.dev/sdk", () => ({ tasks: { trigger: triggerMock } }));
vi.mock("./billing.subscriptions", () => ({ projectSubscription: projectMock }));
vi.mock("@/server/core/billing/stripe-client", () => ({
  getStripeClient: () => stripeMock,
}));
vi.mock("@/server/core/billing/metrics", () => ({
  captureBillingAlert: alertMock,
  recordBillingMetric: metricMock,
}));

function createDb() {
  const db = {
    $transaction: vi.fn(),
    billingCustomer: { findFirst: vi.fn().mockResolvedValue(null) },
    billingEvent: {
      findUnique: vi.fn().mockResolvedValue({
        externalEventId: "evt_1",
        payload: { data: { object: { customer: "cus_1" } } },
        replayCount: 2,
        status: "DEAD_LETTER",
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    billingIssue: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue({ details: { type: "invoice.paid" }, status: "OPEN" }),
      update: vi.fn().mockResolvedValue({}),
    },
    billingSubscription: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };

  db.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(db));

  return db;
}

function stripeSubscription() {
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
          price: { currency: "usd", id: "price_pro", recurring: { interval: "month" } },
          quantity: 1,
        },
      ],
    },
    latest_invoice: null,
    status: "active",
  };
}

function asDb(db: ReturnType<typeof createDb>): DbClient {
  return db as unknown as DbClient;
}

describe("replayBillingEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    triggerMock.mockResolvedValue({ id: "run_2" });
  });

  it("re-enqueues a dead-lettered event with a replay suffix", async () => {
    const db = createDb();

    const result = await replayBillingEvent(asDb(db), {
      actorUserId: "admin_1",
      billingEventId: EVENT_ID,
    });

    expect(result).toEqual({ runId: "run_2" });
    expect(triggerMock).toHaveBeenCalledWith(
      "billing-process-stripe-event",
      { billingEventId: EVENT_ID },
      { concurrencyKey: "customer:cus_1", idempotencyKey: "evt_1:replay:3" },
    );
    expect(db.billingEvent.update).toHaveBeenCalledWith({
      data: { replayCount: { increment: 1 }, status: "ENQUEUED", triggerRunId: "run_2" },
      where: { id: EVENT_ID },
    });
    expect(metricMock).toHaveBeenCalledWith("billing_replay_total", 1, {});
  });

  it("refuses a processed event", async () => {
    const db = createDb();
    db.billingEvent.findUnique.mockResolvedValue({
      externalEventId: "evt_1",
      replayCount: 0,
      status: "PROCESSED",
    });

    await expect(
      replayBillingEvent(asDb(db), { actorUserId: "admin_1", billingEventId: EVENT_ID }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "BILLING_EVENT_ALREADY_PROCESSED",
    });
    expect(triggerMock).not.toHaveBeenCalled();
  });

  it("refuses an event that is currently processing", async () => {
    const db = createDb();
    db.billingEvent.findUnique.mockResolvedValue({
      externalEventId: "evt_1",
      replayCount: 0,
      status: "PROCESSING",
    });

    await expect(
      replayBillingEvent(asDb(db), { actorUserId: "admin_1", billingEventId: EVENT_ID }),
    ).rejects.toMatchObject({
      message: "BILLING_EVENT_NOT_REPLAYABLE",
    });
  });

  it("returns not found for an unknown event", async () => {
    const db = createDb();
    db.billingEvent.findUnique.mockResolvedValue(null);

    await expect(
      replayBillingEvent(asDb(db), { actorUserId: "admin_1", billingEventId: EVENT_ID }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("resolveBillingIssue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves an open issue with a sanitized note", async () => {
    const db = createDb();

    const result = await resolveBillingIssue(asDb(db), {
      actorUserId: "admin_1",
      issueId: ISSUE_ID,
      note: "fixed by hand",
    });

    expect(result).toEqual({ resolved: true });
    expect(db.billingIssue.update).toHaveBeenCalledWith({
      data: {
        details: { resolutionNote: "fixed by hand", type: "invoice.paid" },
        resolvedAt: expect.any(Date),
        status: "RESOLVED",
      },
      where: { id: ISSUE_ID },
    });
  });

  it("redacts a url from the note", async () => {
    const db = createDb();

    await resolveBillingIssue(asDb(db), {
      actorUserId: "admin_1",
      issueId: ISSUE_ID,
      note: "see https://example.com/secret",
    });

    const update = db.billingIssue.update.mock.calls[0]?.[0] as {
      data: { details: { resolutionNote: string } };
    };

    expect(update.data.details.resolutionNote).toBe("see [redacted]");
  });

  it("heals a reviewed subscription before marking the issue resolved", async () => {
    const db = createDb();
    db.billingIssue.findUnique.mockResolvedValue({
      details: {},
      externalObjectId: "sub_1",
      kind: "SUBSCRIPTION_REVIEW",
      status: "OPEN",
      workspaceId: WORKSPACE_ID,
    });
    db.billingCustomer.findFirst.mockResolvedValue({
      externalCustomerId: "cus_1",
      id: "bc_1",
    });
    stripeMock.subscriptions.retrieve.mockResolvedValue(stripeSubscription());
    projectMock.mockResolvedValue({
      accessState: "ACTIVE",
      mirrorId: "bs_1",
      ownsAccess: true,
      reviewReason: null,
    });

    const result = await resolveBillingIssue(asDb(db), {
      actorUserId: "admin_1",
      issueId: ISSUE_ID,
    });

    expect(result).toEqual({ resolved: true });
    expect(db.billingSubscription.updateMany).toHaveBeenCalledWith({
      data: { needsReview: false, reviewReason: null },
      where: { externalSubscriptionId: "sub_1" },
    });
    expect(projectMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        overrideRevivedTerminal: true,
        snapshot: expect.objectContaining({ externalSubscriptionId: "sub_1" }),
      }),
    );
    const [flagOrder] = db.billingSubscription.updateMany.mock.invocationCallOrder;
    const [resolveOrder] = db.billingIssue.update.mock.invocationCallOrder;

    expect(flagOrder).toBeLessThan(resolveOrder ?? 0);
  });

  it("leaves the issue open when Stripe cannot read the subscription", async () => {
    const db = createDb();
    db.billingIssue.findUnique.mockResolvedValue({
      details: {},
      externalObjectId: "sub_1",
      kind: "SUBSCRIPTION_REVIEW",
      status: "OPEN",
      workspaceId: WORKSPACE_ID,
    });
    db.billingCustomer.findFirst.mockResolvedValue({
      externalCustomerId: "cus_1",
      id: "bc_1",
    });
    stripeMock.subscriptions.retrieve.mockRejectedValue(new Error("stripe down"));

    await expect(
      resolveBillingIssue(asDb(db), { actorUserId: "admin_1", issueId: ISSUE_ID }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "BILLING_SUBSCRIPTION_UNREADABLE",
    });
    expect(db.billingIssue.update).not.toHaveBeenCalled();
    expect(projectMock).not.toHaveBeenCalled();
  });

  it("leaves the issue open when the projection fails", async () => {
    const db = createDb();
    db.billingIssue.findUnique.mockResolvedValue({
      details: {},
      externalObjectId: "sub_1",
      kind: "SUBSCRIPTION_REVIEW",
      status: "OPEN",
      workspaceId: WORKSPACE_ID,
    });
    db.billingCustomer.findFirst.mockResolvedValue({
      externalCustomerId: "cus_1",
      id: "bc_1",
    });
    stripeMock.subscriptions.retrieve.mockResolvedValue(stripeSubscription());
    projectMock.mockRejectedValue(new Error("projection failed"));

    await expect(
      resolveBillingIssue(asDb(db), { actorUserId: "admin_1", issueId: ISSUE_ID }),
    ).rejects.toThrow("projection failed");
    expect(db.billingIssue.update).not.toHaveBeenCalled();
  });

  it("refuses to heal without a billing customer mapping", async () => {
    const db = createDb();
    db.billingIssue.findUnique.mockResolvedValue({
      details: {},
      externalObjectId: "sub_1",
      kind: "SUBSCRIPTION_REVIEW",
      status: "OPEN",
      workspaceId: WORKSPACE_ID,
    });

    await expect(
      resolveBillingIssue(asDb(db), { actorUserId: "admin_1", issueId: ISSUE_ID }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "BILLING_CUSTOMER_MISSING",
    });
    expect(db.billingIssue.update).not.toHaveBeenCalled();
  });

  it("is idempotent for an already resolved issue", async () => {
    const db = createDb();
    db.billingIssue.findUnique.mockResolvedValue({ details: {}, status: "RESOLVED" });

    const result = await resolveBillingIssue(asDb(db), {
      actorUserId: "admin_1",
      issueId: ISSUE_ID,
    });

    expect(result).toEqual({ resolved: false });
    expect(db.billingIssue.update).not.toHaveBeenCalled();
  });
});

describe("listBillingIssues", () => {
  it("returns a cursor when there is another page", async () => {
    const db = createDb();
    const rows = Array.from({ length: 51 }, (_, index) => ({
      details: {},
      externalObjectId: null,
      firstSeenAt: new Date(),
      id: `issue_${index}`,
      kind: "TEST",
      lastSeenAt: new Date(),
      resolvedAt: null,
      severity: "CRITICAL",
      source: "test",
      status: "OPEN",
      workspaceId: null,
    }));
    db.billingIssue.findMany.mockResolvedValue(rows);

    const result = await listBillingIssues(asDb(db), { status: "OPEN" });

    expect(result.items).toHaveLength(50);
    expect(result.nextCursor).toBe("issue_49");
  });
});

describe("admin exposure and log hygiene", () => {
  it("exposes the admin procedures only through adminProcedure", () => {
    const source = readFileSync(join(import.meta.dirname, "billing.router.ts"), "utf8");

    expect(source).toContain("listIssues: adminProcedure");
    expect(source).toContain("replayEvent: adminProcedure");
    expect(source).toContain("resolveIssue: adminProcedure");
  });

  it("never puts payloads or amounts into metric labels", () => {
    const source = readFileSync(join(import.meta.dirname, "../../core/billing/metrics.ts"), "utf8");

    // The only logged object is the metric envelope: no request data can slip into it.
    expect(source).toContain(
      'appLogger.info({ labels, metric, msg: "billing.metric", type: "billing.metric", value });',
    );
  });
});
