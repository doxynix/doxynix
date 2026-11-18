import type { BillingEventStatus } from "@doxynix/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/server/core/db";
import { sweepStaleStripeEvents } from "@/server/modules/billing/billing.events";

import { cleanupDatabase } from "../helpers";

const batchTriggerMock = vi.hoisted(() => vi.fn());

vi.mock("@trigger.dev/sdk", () => ({ tasks: { batchTrigger: batchTriggerMock } }));

const MINUTE_MS = 60 * 1000;

async function createEvent(
  externalEventId: string,
  status: BillingEventStatus,
  updatedAt: Date,
): Promise<string> {
  const event = await prisma.billingEvent.create({
    data: {
      externalCreatedAt: updatedAt,
      externalEventId,
      livemode: false,
      payload: { data: { object: { customer: "cus_sweep" } }, id: externalEventId },
      payloadHash: `hash-${externalEventId}`,
      status,
      type: "customer.subscription.updated",
    },
    select: { id: true },
  });

  // `updatedAt` is @updatedAt, so the staleness window has to be written directly.
  await prisma.$executeRaw`
    UPDATE "billing_events" SET "updated_at" = ${updatedAt} WHERE "id" = ${event.id}::uuid
  `;

  return event.id;
}

function staleBy(minutes: number, now: Date = new Date()): Date {
  return new Date(now.getTime() - minutes * MINUTE_MS);
}

describe("stale event sweep", () => {
  beforeEach(async () => {
    await cleanupDatabase();
    batchTriggerMock.mockReset().mockResolvedValue({
      batchId: "batch_sweep_1",
      publicAccessToken: "token_1",
      runCount: 1,
    });
  });

  it("enqueues the guardable rows in one statement and leaves the processed one alone", async () => {
    const now = new Date();
    const staleAt = staleBy(60, now);
    const received = await createEvent("evt_received", "RECEIVED", staleAt);
    const enqueued = await createEvent("evt_enqueued", "ENQUEUED", staleAt);
    const processed = await createEvent("evt_processed", "PROCESSED", staleAt);

    const result = await sweepStaleStripeEvents(now);

    expect(result).toEqual({ requeued: 2 });
    expect(batchTriggerMock).toHaveBeenCalledTimes(1);

    const items = batchTriggerMock.mock.calls[0]?.[1] as Array<{
      options: { concurrencyKey: string; idempotencyKey: string };
      payload: { billingEventId: string };
    }>;

    expect(items).toHaveLength(2);
    expect(items).toEqual(
      expect.arrayContaining([
        {
          options: {
            concurrencyKey: "customer:cus_sweep",
            idempotencyKey: "evt_received:replay:1",
          },
          payload: { billingEventId: received },
        },
        {
          options: {
            concurrencyKey: "customer:cus_sweep",
            idempotencyKey: "evt_enqueued:replay:1",
          },
          payload: { billingEventId: enqueued },
        },
      ]),
    );

    const rows = await prisma.billingEvent.findMany({
      select: {
        externalEventId: true,
        id: true,
        replayCount: true,
        status: true,
        triggerBatchId: true,
        triggerRunId: true,
        updatedAt: true,
      },
      where: { id: { in: [received, enqueued, processed] } },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));

    for (const id of [received, enqueued]) {
      const row = byId.get(id);

      expect(row?.status).toBe("ENQUEUED");
      expect(row?.replayCount).toBe(1);
      expect(row?.triggerBatchId).toBe("batch_sweep_1");
      expect(row?.triggerRunId).toBeNull();
      expect(row?.updatedAt.getTime()).toBeGreaterThan(staleAt.getTime() + 1000);
    }

    const untouched = byId.get(processed);

    expect(untouched?.status).toBe("PROCESSED");
    expect(untouched?.replayCount).toBe(0);
    expect(untouched?.triggerBatchId).toBeNull();
    expect(untouched?.triggerRunId).toBeNull();
    expect(untouched?.updatedAt.getTime()).toBe(staleAt.getTime());
  });

  it("skips a row whose updated_at moved after the select", async () => {
    const received = await createEvent("evt_raced", "RECEIVED", staleBy(60));

    // A worker picking the event up between the select and the bookkeeping write.
    batchTriggerMock.mockImplementation(async () => {
      await prisma.$executeRaw`
          UPDATE "billing_events"
          SET "status" = 'PROCESSING', "updated_at" = now()
          WHERE "id" = ${received}::uuid
        `;

      return { batchId: "batch_raced", publicAccessToken: "token_1", runCount: 1 };
    });

    const result = await sweepStaleStripeEvents();

    expect(result).toEqual({ requeued: 0 });

    const row = await prisma.billingEvent.findUnique({
      select: { replayCount: true, status: true, triggerBatchId: true, triggerRunId: true },
      where: { id: received },
    });

    expect(row?.status).toBe("PROCESSING");
    expect(row?.replayCount).toBe(0);
    expect(row?.triggerBatchId).toBeNull();
    expect(row?.triggerRunId).toBeNull();
  });
});
