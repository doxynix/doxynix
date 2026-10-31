import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { Prisma } from "@prisma/client";
import { join } from "pathe";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleStripeWebhook } from "./billing.webhook";
import { signStripePayload } from "./test-fixtures/sign";

const dbMock = vi.hoisted(() => ({
  billingEvent: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  billingIssue: {
    createMany: vi.fn().mockResolvedValue({ count: 1 }),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
}));

const triggerMock = vi.hoisted(() => vi.fn());

vi.mock("@/server/core/db", () => ({ prisma: dbMock }));
vi.mock("@trigger.dev/sdk", () => ({ tasks: { trigger: triggerMock } }));

const FIXTURES_DIR = join(import.meta.dirname, "test-fixtures", "events");

function fixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, `${name}.json`), "utf8");
}

function request(payload: string, signature: null | string): Request {
  return new Request("http://localhost/api/webhooks/stripe", {
    body: payload,
    headers: signature == null ? undefined : { "stripe-signature": signature },
    method: "POST",
  });
}

function hash(payload: string): string {
  return createHash("sha256").update(payload).digest("hex");
}

describe("recorded Stripe fixtures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.billingEvent.create.mockResolvedValue({
      id: "be_1",
      replayCount: 0,
      status: "RECEIVED",
    });
    dbMock.billingEvent.findUnique.mockResolvedValue(null);
    dbMock.billingEvent.update.mockResolvedValue({});
    triggerMock.mockResolvedValue({ id: "run_1" });
  });

  it.each([
    ["subscription-created", "customer.subscription.created"],
    ["subscription-updated", "customer.subscription.updated"],
    ["subscription-deleted", "customer.subscription.deleted"],
    ["invoice-paid", "invoice.paid"],
    ["invoice-payment-failed", "invoice.payment_failed"],
    ["charge-refunded", "charge.refunded"],
    ["dispute-created", "charge.dispute.created"],
    ["checkout-completed", "checkout.session.completed"],
    ["refund-created", "refund.created"],
  ])("accepts the recorded %s payload", async (name, type) => {
    const payload = fixture(name);
    const response = await handleStripeWebhook(request(payload, signStripePayload(payload)));

    expect(response.status).toBe(200);
    expect(dbMock.billingEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          apiVersion: "2026-09-30.endive",
          payloadHash: hash(payload),
          type,
        }),
      }),
    );
  });

  it("rejects a byte changed after signing", async () => {
    const payload = fixture("invoice-paid");
    const signature = signStripePayload(payload);

    const response = await handleStripeWebhook(request(`${payload}\n`, signature));

    expect(response.status).toBe(400);
    expect(dbMock.billingEvent.create).not.toHaveBeenCalled();
  });

  it("rejects an expired signature timestamp", async () => {
    const payload = fixture("invoice-paid");
    const expired = Math.floor(Date.now() / 1000) - 400;

    const response = await handleStripeWebhook(
      request(payload, signStripePayload(payload, { timestamp: expired })),
    );

    expect(response.status).toBe(400);
    expect(dbMock.billingEvent.create).not.toHaveBeenCalled();
  });

  it("rejects a forged signature", async () => {
    const payload = fixture("invoice-paid");

    const response = await handleStripeWebhook(
      request(payload, signStripePayload(payload, { secret: "whsec_forged" })),
    );

    expect(response.status).toBe(400);
  });

  it("acknowledges a redelivered event without a second run", async () => {
    const payload = fixture("subscription-created");
    const signature = signStripePayload(payload);

    const first = await handleStripeWebhook(request(payload, signature));
    dbMock.billingEvent.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        clientVersion: Prisma.prismaVersion.client,
        code: "P2002",
      }),
    );
    dbMock.billingEvent.findUnique.mockResolvedValueOnce({
      id: "be_1",
      payloadHash: hash(payload),
      replayCount: 0,
      status: "PROCESSED",
    });
    const second = await handleStripeWebhook(request(payload, signature));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(triggerMock).toHaveBeenCalledTimes(1);
  });

  it("stores every event of the out-of-order sequence", async () => {
    const sequence = JSON.parse(fixture("out-of-order")) as Array<{ type: string }>;

    for (const event of sequence) {
      const payload = JSON.stringify(event);
      const response = await handleStripeWebhook(request(payload, signStripePayload(payload)));

      expect(response.status).toBe(200);
    }

    expect(dbMock.billingEvent.create).toHaveBeenCalledTimes(sequence.length);
  });

  it("returns 500 when the queue is unavailable and keeps the event RECEIVED", async () => {
    const payload = fixture("invoice-paid");
    triggerMock.mockRejectedValueOnce(new Error("trigger unavailable"));

    const response = await handleStripeWebhook(request(payload, signStripePayload(payload)));

    expect(response.status).toBe(500);
    expect(dbMock.billingEvent.update).not.toHaveBeenCalled();
  });
});
