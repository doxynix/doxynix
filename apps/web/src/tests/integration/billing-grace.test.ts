import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/core/db";
import { getWorkspaceEntitlement } from "@/server/core/entitlements";
import { proPlan } from "@/server/modules/billing/billing.catalog";
import { applyInvoiceEvent } from "@/server/modules/billing/billing.invoices";
import { fromStripeSubscription } from "@/server/modules/billing/billing.snapshot";
import { projectSubscription } from "@/server/modules/billing/billing.subscriptions";

import { cleanupDatabase, createTestUser } from "../helpers";

const CUSTOMER_ID = "cus_grace_test";
const SUBSCRIPTION_ID = "sub_grace_test";
const PRICE_ID = proPlan().priceId;
const NOW = new Date("2026-10-31T12:00:00.000Z");

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    cancel_at: null,
    cancel_at_period_end: false,
    customer: CUSTOMER_ID,
    id: SUBSCRIPTION_ID,
    items: {
      data: [
        {
          current_period_end: Math.floor(NOW.getTime() / 1000) + 86_400 * 30,
          current_period_start: Math.floor(NOW.getTime() / 1000),
          id: "si_grace_test",
          price: { currency: "usd", id: PRICE_ID, recurring: { interval: "month" } },
          quantity: 1,
        },
      ],
    },
    latest_invoice: {
      id: "in_grace_paid",
      status: "paid",
      status_transitions: { paid_at: Math.floor(NOW.getTime() / 1000) },
    },
    status: "active",
    ...overrides,
  };
}

function failedInvoice(createdAt: Date) {
  return {
    amount_paid: 0,
    created: Math.floor(createdAt.getTime() / 1000),
    currency: "usd",
    id: "in_grace_failed",
    parent: { subscription_details: { subscription: SUBSCRIPTION_ID } },
    status_transitions: { paid_at: null },
  };
}

describe("billing grace window", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  it("grants access during grace and revokes it after the deadline", async () => {
    const alice = await createTestUser("GraceOwner");
    const mapping = await prisma.billingCustomer.create({
      data: {
        externalCustomerId: CUSTOMER_ID,
        livemode: false,
        provider: "stripe",
        workspaceId: alice.workspace.id,
      },
    });
    const ownership = {
      billingCustomerId: mapping.id,
      customerId: CUSTOMER_ID,
      workspaceId: alice.workspace.id,
    };

    await prisma.$transaction(async (tx) => {
      await projectSubscription(tx, {
        now: NOW,
        ownership,
        snapshot: fromStripeSubscription(subscription() as never),
      });
    });

    const activated = await getWorkspaceEntitlement(prisma, alice.workspace.id);

    expect(activated).toMatchObject({ accessState: "ACTIVE", hasAccess: true });

    const failedAt = new Date(NOW.getTime() + 86_400_000);

    await prisma.$transaction(async (tx) => {
      await applyInvoiceEvent(tx, {
        billingEventId: "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d",
        eventCreatedAt: failedAt,
        eventType: "invoice.payment_failed",
        invoice: failedInvoice(failedAt) as never,
        now: failedAt,
        ownership,
        subscription: subscription({ status: "past_due" }) as never,
      });
    });

    const inGrace = await getWorkspaceEntitlement(prisma, alice.workspace.id, failedAt);

    expect(inGrace).toMatchObject({ accessState: "GRACE", hasAccess: true });
    expect(inGrace?.graceEndsAt).not.toBeNull();

    const afterGrace = await getWorkspaceEntitlement(
      prisma,
      alice.workspace.id,
      new Date(failedAt.getTime() + 8 * 86_400_000),
    );

    expect(afterGrace).toMatchObject({ accessState: "GRACE", hasAccess: false });
  });
});
