import { beforeEach, describe, expect, it } from "vitest";

import { purgeBillingEventPayloads } from "@/server/core/billing/purge";
import { prisma } from "@/server/core/db";

import { cleanupDatabase } from "../helpers";

const DAY_MS = 24 * 60 * 60 * 1000;

async function createEvent(stripeEventId: string, receivedAt: Date) {
  return prisma.billingEvent.create({
    data: {
      livemode: false,
      payload: { id: stripeEventId },
      payloadHash: `hash-${stripeEventId}`,
      receivedAt,
      stripeCreatedAt: receivedAt,
      stripeEventId,
      type: "invoice.paid",
    },
  });
}

describe("billing event payload purge", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  it("drops an old payload but keeps the row and the event id", async () => {
    const old = new Date(Date.now() - 91 * DAY_MS);
    const event = await createEvent("evt_old", old);

    const purged = await purgeBillingEventPayloads(prisma);

    const row = await prisma.billingEvent.findUnique({ where: { id: event.id } });

    expect(purged).toBe(1);
    expect(row?.payload).toBeNull();
    expect(row?.stripeEventId).toBe("evt_old");
  });

  it("does not touch an already purged payload twice", async () => {
    const old = new Date(Date.now() - 91 * DAY_MS);
    await createEvent("evt_once", old);

    const first = await purgeBillingEventPayloads(prisma);
    const second = await purgeBillingEventPayloads(prisma);

    expect(first).toBe(1);
    expect(second).toBe(0);
  });

  it("keeps a payload inside the retention window", async () => {
    const recent = new Date(Date.now() - 10 * DAY_MS);
    const event = await createEvent("evt_recent", recent);

    const purged = await purgeBillingEventPayloads(prisma);

    const row = await prisma.billingEvent.findUnique({ where: { id: event.id } });

    expect(purged).toBe(0);
    expect(row?.payload).toEqual({ id: "evt_recent" });
  });
});
