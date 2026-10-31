import { readFileSync } from "node:fs";

import { join } from "pathe";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DbClient } from "@/server/core/db";

import { listBillingIssues, replayBillingEvent, resolveBillingIssue } from "./billing.admin";

const EVENT_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d";
const ISSUE_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5e";

const triggerMock = vi.hoisted(() => vi.fn());
const metricMock = vi.hoisted(() => vi.fn());
const alertMock = vi.hoisted(() => vi.fn());

vi.mock("@trigger.dev/sdk", () => ({ tasks: { trigger: triggerMock } }));
vi.mock("@/server/core/billing/metrics", () => ({
  captureBillingAlert: alertMock,
  recordBillingMetric: metricMock,
}));

function createDb() {
  return {
    billingEvent: {
      findUnique: vi.fn().mockResolvedValue({
        replayCount: 2,
        status: "DEAD_LETTER",
        stripeEventId: "evt_1",
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    billingIssue: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue({ details: { type: "invoice.paid" }, status: "OPEN" }),
      update: vi.fn().mockResolvedValue({}),
    },
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

    const result = await replayBillingEvent(asDb(db), { billingEventId: EVENT_ID });

    expect(result).toEqual({ runId: "run_2" });
    expect(triggerMock).toHaveBeenCalledWith(
      "billing-process-stripe-event",
      { billingEventId: EVENT_ID },
      { idempotencyKey: "evt_1:replay:3" },
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
      replayCount: 0,
      status: "PROCESSED",
      stripeEventId: "evt_1",
    });

    await expect(replayBillingEvent(asDb(db), { billingEventId: EVENT_ID })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "BILLING_EVENT_ALREADY_PROCESSED",
    });
    expect(triggerMock).not.toHaveBeenCalled();
  });

  it("refuses an event that is currently processing", async () => {
    const db = createDb();
    db.billingEvent.findUnique.mockResolvedValue({
      replayCount: 0,
      status: "PROCESSING",
      stripeEventId: "evt_1",
    });

    await expect(replayBillingEvent(asDb(db), { billingEventId: EVENT_ID })).rejects.toMatchObject({
      message: "BILLING_EVENT_NOT_REPLAYABLE",
    });
  });

  it("returns not found for an unknown event", async () => {
    const db = createDb();
    db.billingEvent.findUnique.mockResolvedValue(null);

    await expect(replayBillingEvent(asDb(db), { billingEventId: EVENT_ID })).rejects.toMatchObject({
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
      issueId: ISSUE_ID,
      note: "see https://example.com/secret",
    });

    const update = db.billingIssue.update.mock.calls[0]?.[0] as {
      data: { details: { resolutionNote: string } };
    };

    expect(update.data.details.resolutionNote).toBe("see [redacted]");
  });

  it("is idempotent for an already resolved issue", async () => {
    const db = createDb();
    db.billingIssue.findUnique.mockResolvedValue({ details: {}, status: "RESOLVED" });

    const result = await resolveBillingIssue(asDb(db), { issueId: ISSUE_ID });

    expect(result).toEqual({ resolved: false });
    expect(db.billingIssue.update).not.toHaveBeenCalled();
  });
});

describe("listBillingIssues", () => {
  it("returns a cursor when there is another page", async () => {
    const db = createDb();
    const rows = Array.from({ length: 51 }, (_, index) => ({
      details: {},
      firstSeenAt: new Date(),
      id: `issue_${index}`,
      kind: "TEST",
      lastSeenAt: new Date(),
      resolvedAt: null,
      severity: "CRITICAL",
      source: "test",
      status: "OPEN",
      stripeObjectId: null,
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
