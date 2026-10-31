import { createHash } from "node:crypto";

import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { STRIPE_WEBHOOK_SECRET } from "@/shared/config/env.server";

import { getStripeClient } from "./billing.stripe";
import { handleStripeWebhook } from "./billing.webhook";

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

function eventBody(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    api_version: "2026-09-30.endive",
    created: Math.floor(Date.now() / 1000),
    data: { object: { customer: "cus_test", id: "cs_test", object: "checkout.session" } },
    id: "evt_test_1",
    livemode: false,
    pending_webhooks: 1,
    request: null,
    type: "checkout.session.completed",
    ...overrides,
  });
}

function sign(payload: string, timestamp?: number) {
  return getStripeClient().webhooks.generateTestHeaderString({
    payload,
    secret: STRIPE_WEBHOOK_SECRET,
    timestamp,
  });
}

function webhookRequest(payload: string, signature: null | string) {
  const headers = signature == null ? undefined : { "stripe-signature": signature };

  return new Request("http://localhost/api/webhooks/stripe", {
    body: payload,
    headers,
    method: "POST",
  });
}

function payloadHash(payload: string) {
  return createHash("sha256").update(payload).digest("hex");
}

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields", {
    clientVersion: Prisma.prismaVersion.client,
    code: "P2002",
  });
}

describe("stripe webhook intake", () => {
  beforeEach(() => {
    dbMock.billingEvent.create
      .mockReset()
      .mockResolvedValue({ id: "be_1", replayCount: 0, status: "RECEIVED" });
    dbMock.billingEvent.findUnique.mockReset().mockResolvedValue(null);
    dbMock.billingEvent.update.mockReset().mockResolvedValue({});
    dbMock.billingIssue.createMany.mockReset().mockResolvedValue({ count: 1 });
    dbMock.billingIssue.updateMany.mockReset().mockResolvedValue({ count: 1 });
    triggerMock.mockReset().mockResolvedValue({ id: "run_1" });
  });

  it("stores a signed event and enqueues it with the Stripe event id", async () => {
    const payload = eventBody();

    const response = await handleStripeWebhook(webhookRequest(payload, sign(payload)));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(dbMock.billingEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        livemode: false,
        payloadHash: payloadHash(payload),
        status: "RECEIVED",
        stripeEventId: "evt_test_1",
        type: "checkout.session.completed",
      }),
      select: expect.anything(),
    });
    expect(triggerMock).toHaveBeenCalledWith(
      "billing-process-stripe-event",
      { billingEventId: "be_1" },
      { concurrencyKey: "customer:cus_test", idempotencyKey: "evt_test_1" },
    );
    expect(dbMock.billingEvent.update).toHaveBeenCalledWith({
      data: { status: "ENQUEUED", triggerRunId: "run_1" },
      where: { id: "be_1" },
    });
  });

  it("rejects a request without a signature header", async () => {
    const response = await handleStripeWebhook(webhookRequest(eventBody(), null));

    expect(response.status).toBe(400);
    expect(dbMock.billingEvent.create).not.toHaveBeenCalled();
  });

  it("rejects a malformed signature", async () => {
    const response = await handleStripeWebhook(webhookRequest(eventBody(), "t=1,v1=deadbeef"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "INVALID_SIGNATURE" });
    expect(dbMock.billingEvent.create).not.toHaveBeenCalled();
  });

  it("rejects a body changed after signing", async () => {
    const payload = eventBody();
    const signature = sign(payload);

    const response = await handleStripeWebhook(webhookRequest(`${payload} `, signature));

    expect(response.status).toBe(400);
    expect(dbMock.billingEvent.create).not.toHaveBeenCalled();
  });

  it("rejects a signature outside the default tolerance", async () => {
    const payload = eventBody();
    const expired = Math.floor(Date.now() / 1000) - 400;

    const response = await handleStripeWebhook(webhookRequest(payload, sign(payload, expired)));

    expect(response.status).toBe(400);
    expect(dbMock.billingEvent.create).not.toHaveBeenCalled();
  });

  it("acknowledges an already processed duplicate without enqueueing it again", async () => {
    const payload = eventBody();
    dbMock.billingEvent.create.mockRejectedValueOnce(uniqueViolation());
    dbMock.billingEvent.findUnique.mockResolvedValueOnce({
      id: "be_1",
      payloadHash: payloadHash(payload),
      status: "PROCESSED",
    });

    const response = await handleStripeWebhook(webhookRequest(payload, sign(payload)));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ duplicate: true, ok: true });
    expect(triggerMock).not.toHaveBeenCalled();
  });

  it("re-enqueues a duplicate that was never enqueued", async () => {
    const payload = eventBody();
    dbMock.billingEvent.create.mockRejectedValueOnce(uniqueViolation());
    dbMock.billingEvent.findUnique.mockResolvedValueOnce({
      id: "be_1",
      payloadHash: payloadHash(payload),
      replayCount: 0,
      status: "RECEIVED",
    });

    const response = await handleStripeWebhook(webhookRequest(payload, sign(payload)));

    expect(response.status).toBe(200);
    expect(triggerMock).toHaveBeenCalledTimes(1);
    expect(dbMock.billingEvent.update).toHaveBeenCalledWith({
      data: { status: "ENQUEUED", triggerRunId: "run_1" },
      where: { id: "be_1" },
    });
  });

  it("replays a dead-lettered event under a fresh Trigger key", async () => {
    const payload = eventBody();
    dbMock.billingEvent.create.mockRejectedValueOnce(uniqueViolation());
    dbMock.billingEvent.findUnique.mockResolvedValueOnce({
      id: "be_1",
      payloadHash: payloadHash(payload),
      replayCount: 2,
      status: "DEAD_LETTER",
    });

    const response = await handleStripeWebhook(webhookRequest(payload, sign(payload)));

    expect(response.status).toBe(200);
    expect(triggerMock).toHaveBeenCalledWith(
      "billing-process-stripe-event",
      { billingEventId: "be_1" },
      { concurrencyKey: "customer:cus_test", idempotencyKey: "evt_test_1:replay:3" },
    );
    expect(dbMock.billingEvent.update).toHaveBeenCalledWith({
      data: {
        replayCount: { increment: 1 },
        status: "ENQUEUED",
        triggerRunId: "run_1",
      },
      where: { id: "be_1" },
    });
  });

  it("lets only one of two concurrent duplicates create the row", async () => {
    const payload = eventBody();
    const signature = sign(payload);
    dbMock.billingEvent.create
      .mockResolvedValueOnce({ id: "be_1", replayCount: 0, status: "RECEIVED" })
      .mockRejectedValueOnce(uniqueViolation());
    dbMock.billingEvent.findUnique.mockResolvedValueOnce({
      id: "be_1",
      payloadHash: payloadHash(payload),
      replayCount: 0,
      status: "RECEIVED",
    });

    const responses = await Promise.all([
      handleStripeWebhook(webhookRequest(payload, signature)),
      handleStripeWebhook(webhookRequest(payload, signature)),
    ]);

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(dbMock.billingEvent.create).toHaveBeenCalledTimes(2);
    expect(triggerMock).toHaveBeenCalledTimes(2);
    expect(
      triggerMock.mock.calls.map((call) => (call[2] as { idempotencyKey: string }).idempotencyKey),
    ).toEqual(["evt_test_1", "evt_test_1"]);
  });

  it("returns 500 when the queue is unavailable so Stripe retries", async () => {
    const payload = eventBody();
    triggerMock.mockRejectedValueOnce(new Error("queue unavailable"));

    const response = await handleStripeWebhook(webhookRequest(payload, sign(payload)));

    expect(response.status).toBe(500);
    expect(dbMock.billingEvent.update).not.toHaveBeenCalled();
  });

  it("returns 500 when the event cannot be stored", async () => {
    const payload = eventBody();
    dbMock.billingEvent.create.mockRejectedValueOnce(new Error("database unavailable"));

    const response = await handleStripeWebhook(webhookRequest(payload, sign(payload)));

    expect(response.status).toBe(500);
    expect(triggerMock).not.toHaveBeenCalled();
  });

  it("ignores a signed event type the endpoint does not handle", async () => {
    const payload = eventBody({ type: "customer.created" });

    const response = await handleStripeWebhook(webhookRequest(payload, sign(payload)));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ignored: true });
    expect(dbMock.billingEvent.create).not.toHaveBeenCalled();
  });

  it("rejects a signed event whose livemode does not match the environment", async () => {
    const payload = eventBody({ livemode: true });

    const response = await handleStripeWebhook(webhookRequest(payload, sign(payload)));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "LIVEMODE_MISMATCH" });
    expect(dbMock.billingEvent.create).not.toHaveBeenCalled();
  });

  it("rejects a reused event id with a different body and records an issue", async () => {
    const payload = eventBody();
    dbMock.billingEvent.create.mockRejectedValueOnce(uniqueViolation());
    dbMock.billingEvent.findUnique.mockResolvedValueOnce({
      id: "be_1",
      payloadHash: "a-different-hash",
      replayCount: 0,
      status: "PROCESSED",
    });

    const response = await handleStripeWebhook(webhookRequest(payload, sign(payload)));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ duplicate: true, hashMismatch: true });
    expect(dbMock.billingIssue.createMany).toHaveBeenCalledTimes(1);
    expect(triggerMock).not.toHaveBeenCalled();
  });
});
