import { readFileSync } from "node:fs";

import { join } from "pathe";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/server/core/db";
import { proPlan } from "@/server/modules/billing/billing.catalog";
import { processStripeEvent } from "@/server/modules/billing/billing.events";
import type * as BillingStripe from "@/server/modules/billing/billing.stripe";
import { handleStripeWebhook } from "@/server/modules/billing/billing.webhook";
import { signStripePayload } from "@/server/modules/billing/test-fixtures/sign";

import { cleanupDatabase, createTestUser } from "../helpers";

const triggerMock = vi.hoisted(() => vi.fn());
const stripeRetrieve = vi.hoisted(() => vi.fn());

vi.mock("@trigger.dev/sdk", () => ({ tasks: { trigger: triggerMock } }));

// The real client is kept for signature verification; only the canonical subscription read is
// replaced, so the webhook path stays end-to-end.
vi.mock("@/server/modules/billing/billing.stripe", async (importOriginal) => {
  const actual = await importOriginal<typeof BillingStripe>();
  const client = actual.getStripeClient();
  client.subscriptions.retrieve = stripeRetrieve;

  return { ...actual, getStripeClient: () => client };
});

const FIXTURES_DIR = join(import.meta.dirname, "../../server/modules/billing/test-fixtures/events");

type Fixture = {
  data: { object: Record<string, unknown> };
  [key: string]: unknown;
};

function fixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, `${name}.json`), "utf8");
}

function payloadOf(name: string): Fixture {
  return JSON.parse(fixture(name)) as Fixture;
}

function withObject(payload: Fixture, object: Record<string, unknown>): Fixture {
  return { ...payload, data: { object: { ...payload.data.object, ...object } } };
}

function request(body: string, signature: string): Request {
  return new Request("http://localhost/api/webhooks/stripe", {
    body,
    headers: { "stripe-signature": signature },
    method: "POST",
  });
}

function canceledSubscription(id: string, customer: string) {
  return {
    cancel_at: null,
    cancel_at_period_end: false,
    customer,
    id,
    items: {
      data: [
        {
          current_period_end: 1_800_000_000,
          current_period_start: 1_790_000_000,
          id: `${id}_item`,
          price: { currency: "usd", id: proPlan().priceId, recurring: { interval: "month" } },
          quantity: 1,
        },
      ],
    },
    latest_invoice: null,
    status: "canceled",
  };
}

async function seedCustomer(workspaceId: string, customerId: string) {
  await prisma.billingCustomer.create({
    data: {
      externalCustomerId: customerId,
      livemode: false,
      provider: "stripe",
      workspaceId,
    },
  });
}

describe("billing webhooks against Postgres", () => {
  beforeEach(async () => {
    await cleanupDatabase();
    const runs = new Map<string, string>();
    triggerMock
      .mockReset()
      .mockImplementation(
        async (_task: string, _payload: unknown, options: { idempotencyKey: string }) => {
          const existing = runs.get(options.idempotencyKey);

          if (existing != null) {
            return { id: existing };
          }

          const id = `run_${runs.size + 1}`;
          runs.set(options.idempotencyKey, id);

          return { id };
        },
      );
    stripeRetrieve.mockReset();
  });

  it("creates one event row and one run for two concurrent deliveries", async () => {
    const body = fixture("subscription-created");
    const signature = signStripePayload(body);

    const responses = await Promise.all([
      handleStripeWebhook(request(body, signature)),
      handleStripeWebhook(request(body, signature)),
    ]);

    const event = JSON.parse(body) as { id: string };
    const rows = await prisma.billingEvent.findMany({ where: { stripeEventId: event.id } });
    const keys = triggerMock.mock.calls.map(
      (call) => (call[2] as { idempotencyKey: string }).idempotencyKey,
    );

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(rows).toHaveLength(1);
    expect(new Set(keys).size).toBe(1);
    expect(rows[0]?.triggerRunId).toBe("run_1");
  });

  it("keeps both events of a deleted → updated sequence on one subscription", async () => {
    const alice = await createTestUser("Alice");
    const customerId = "cus_out_of_order";
    const subscriptionId = "sub_out_of_order";

    await seedCustomer(alice.workspace.id, customerId);
    stripeRetrieve.mockResolvedValue(canceledSubscription(subscriptionId, customerId));

    const sequence = [
      withObject(payloadOf("subscription-deleted"), { customer: customerId, id: subscriptionId }),
      withObject(payloadOf("subscription-updated"), { customer: customerId, id: subscriptionId }),
    ];

    for (const payload of sequence) {
      const body = JSON.stringify(payload);
      const response = await handleStripeWebhook(request(body, signStripePayload(body)));

      expect(response.status).toBe(200);
    }

    const rows = await prisma.billingEvent.findMany({
      where: { type: { in: ["customer.subscription.deleted", "customer.subscription.updated"] } },
    });
    expect(rows).toHaveLength(2);

    for (const row of rows) {
      await expect(processStripeEvent(row.id)).resolves.toEqual({ status: "processed" });
    }

    const entitlement = await prisma.workspaceEntitlement.findUnique({
      where: { workspaceId: alice.workspace.id },
    });

    // A terminal subscription stays CANCELED; the sequence must not fall into REVIEW.
    expect(entitlement?.accessState).toBe("CANCELED");
  });

  it("does not lose RECEIVED or ENQUEUED events when the worker restarts", async () => {
    const alice = await createTestUser("Alice");
    const customerId = "cus_restart";

    await seedCustomer(alice.workspace.id, customerId);
    stripeRetrieve.mockImplementation(async (id: string) => canceledSubscription(id, customerId));

    for (const [index, fixtureName] of ["subscription-created", "subscription-updated"].entries()) {
      const payload = withObject(payloadOf(fixtureName), {
        customer: customerId,
        id: `sub_restart_${index}`,
      });
      const body = JSON.stringify(payload);
      await handleStripeWebhook(request(body, signStripePayload(body)));
    }

    const pending = await prisma.billingEvent.findMany({
      where: { status: { in: ["RECEIVED", "ENQUEUED"] } },
    });
    expect(pending).toHaveLength(2);

    for (const row of pending) {
      await processStripeEvent(row.id);
    }

    const processed = await prisma.billingEvent.count({ where: { status: "PROCESSED" } });
    expect(processed).toBe(2);
  });
});
