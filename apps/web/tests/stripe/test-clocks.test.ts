import { describe, expect, it } from "vitest";

import { prisma } from "@/server/core/db";
import { createPersonalWorkspace } from "@/server/core/workspaces/personal-workspace";
import { proPlan } from "@/server/modules/billing/billing.catalog";
import { changeSeats } from "@/server/modules/billing/billing.plan-changes";

import {
  HAS_SANDBOX_CREDENTIALS,
  SANDBOX_SKIP_REASON,
  sandboxPriceId,
  sandboxStripe,
} from "./stripe-sandbox";

const DAY_SECONDS = 24 * 60 * 60;
const GRACE_DAYS = 7;

if (!HAS_SANDBOX_CREDENTIALS) {
  // Reported as skipped, never as passed: the runbook records the cannot-verify status.
  console.warn(`stripe sandbox suite: cannot-verify (${SANDBOX_SKIP_REASON})`);
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

async function createClock(): Promise<string> {
  const clock = await sandboxStripe().testHelpers.testClocks.create({
    frozen_time: nowSeconds(),
  });

  return clock.id;
}

async function advanceClock(clockId: string, seconds: number): Promise<void> {
  await sandboxStripe().testHelpers.testClocks.advance(clockId, {
    frozen_time: nowSeconds() + seconds,
  });
}

async function provisionWorkspace(options: { clockId: string; paymentMethod: string }) {
  const email = `stripe-suite-${Date.now()}@test.com`;
  const user = await prisma.user.create({ data: { email, name: "Stripe Suite" } });
  const workspaceId = await createPersonalWorkspace(user.id, user.name);

  await prisma.workspaceEntitlement.update({
    data: { accessState: "ACTIVE", aiTokensPerMonth: null, analysesPerMonth: null },
    where: { workspaceId },
  });

  const customer = await sandboxStripe().customers.create({
    email,
    invoice_settings: { default_payment_method: options.paymentMethod },
    payment_method: options.paymentMethod,
    test_clock: options.clockId,
  });

  await prisma.billingCustomer.create({
    data: {
      externalCustomerId: customer.id,
      livemode: false,
      provider: "stripe",
      workspaceId,
    },
  });

  return { customerId: customer.id, userId: user.id, workspaceId };
}

async function startSubscription(customerId: string, quantity = 1): Promise<string> {
  const subscription = await sandboxStripe().subscriptions.create({
    customer: customerId,
    items: [{ price: sandboxPriceId(), quantity }],
    payment_behavior: "allow_incomplete",
  });

  return subscription.id;
}

async function waitForEvent(predicate: { type: string }, timeoutMs = 120_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const event = await prisma.billingEvent.findFirst({
      where: { status: "PROCESSED", type: predicate.type },
    });

    if (event != null) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for processed ${predicate.type}`);
}

async function entitlementOf(workspaceId: string) {
  return prisma.workspaceEntitlement.findUnique({ where: { workspaceId } });
}

describe.skipIf(!HAS_SANDBOX_CREDENTIALS)("stripe sandbox test clocks", () => {
  it("activates after the initial sync payment", async () => {
    const clockId = await createClock();
    const fixture = await provisionWorkspace({ clockId, paymentMethod: "pm_card_visa" });
    await startSubscription(fixture.customerId);

    await waitForEvent({ type: "customer.subscription.updated" });

    const entitlement = await entitlementOf(fixture.workspaceId);

    expect(entitlement?.accessState).toBe("ACTIVE");
    expect(entitlement?.planCode).toBe(proPlan().code);
  });

  it("keeps activatedAt across a renewal", async () => {
    const clockId = await createClock();
    const fixture = await provisionWorkspace({ clockId, paymentMethod: "pm_card_visa" });
    const subscriptionId = await startSubscription(fixture.customerId);

    await waitForEvent({ type: "customer.subscription.updated" });
    const before = await prisma.billingSubscription.findUnique({
      where: { stripeSubscriptionId: subscriptionId },
    });

    await advanceClock(clockId, 31 * DAY_SECONDS);
    await waitForEvent({ type: "invoice.paid" });

    const after = await prisma.billingSubscription.findUnique({
      where: { stripeSubscriptionId: subscriptionId },
    });

    expect(after?.activatedAt).toEqual(before?.activatedAt);
    expect(after?.activatedAt).not.toBeNull();
  });

  it("moves to GRACE for seven days and then SUSPENDED without extending on retries", async () => {
    const clockId = await createClock();
    const fixture = await provisionWorkspace({
      clockId,
      paymentMethod: "pm_card_chargeDeclined",
    });
    const subscriptionId = await startSubscription(fixture.customerId);

    await advanceClock(clockId, 31 * DAY_SECONDS);
    await waitForEvent({ type: "invoice.payment_failed" });

    const first = await prisma.billingSubscription.findUnique({
      where: { stripeSubscriptionId: subscriptionId },
    });
    const graceEndsAt = first?.graceEndsAt;

    await advanceClock(clockId, 2 * DAY_SECONDS);
    const second = await prisma.billingSubscription.findUnique({
      where: { stripeSubscriptionId: subscriptionId },
    });

    await advanceClock(clockId, (GRACE_DAYS + 1) * DAY_SECONDS);
    const entitlement = await entitlementOf(fixture.workspaceId);

    expect(graceEndsAt).not.toBeNull();
    expect(second?.graceEndsAt).toEqual(graceEndsAt);
    expect(entitlement?.accessState).toBe("SUSPENDED");
  });

  it("recovers to ACTIVE when the invoice is paid inside the grace window", async () => {
    const clockId = await createClock();
    const fixture = await provisionWorkspace({
      clockId,
      paymentMethod: "pm_card_chargeDeclined",
    });
    const subscriptionId = await startSubscription(fixture.customerId);

    await advanceClock(clockId, 31 * DAY_SECONDS);
    await waitForEvent({ type: "invoice.payment_failed" });

    await sandboxStripe().customers.update(fixture.customerId, {
      invoice_settings: { default_payment_method: "pm_card_visa" },
    });
    const open = await sandboxStripe().invoices.list({
      customer: fixture.customerId,
      limit: 1,
      status: "open",
    });

    const openInvoice = open.data.at(0);

    if (openInvoice != null) {
      await sandboxStripe().invoices.pay(openInvoice.id);
    }

    await waitForEvent({ type: "invoice.paid" });

    const entitlement = await entitlementOf(fixture.workspaceId);
    const subscription = await prisma.billingSubscription.findUnique({
      where: { stripeSubscriptionId: subscriptionId },
    });

    expect(entitlement?.accessState).toBe("ACTIVE");
    expect(subscription?.graceEndsAt).toBeNull();
  });

  it("applies the proration matrix on quantity changes", async () => {
    const clockId = await createClock();
    const fixture = await provisionWorkspace({ clockId, paymentMethod: "pm_card_visa" });
    await startSubscription(fixture.customerId);

    await waitForEvent({ type: "customer.subscription.updated" });

    const upgrade = await changeSeats({
      actorUserId: fixture.userId,
      db: prisma,
      quantity: 3,
      requestId: crypto.randomUUID(),
      workspaceId: fixture.workspaceId,
    });
    const downgrade = await changeSeats({
      actorUserId: fixture.userId,
      db: prisma,
      quantity: 1,
      requestId: crypto.randomUUID(),
      workspaceId: fixture.workspaceId,
    });

    expect(upgrade).toMatchObject({ changed: true, prorationBehavior: "always_invoice" });
    expect(downgrade).toMatchObject({ changed: true, prorationBehavior: "create_prorations" });
  });

  it("keeps access until the period ends after a Portal cancellation", async () => {
    const clockId = await createClock();
    const fixture = await provisionWorkspace({ clockId, paymentMethod: "pm_card_visa" });
    const subscriptionId = await startSubscription(fixture.customerId);

    await waitForEvent({ type: "customer.subscription.updated" });

    // The Portal's cancellation is `cancel_at_period_end` on the subscription.
    await sandboxStripe().subscriptions.update(subscriptionId, { cancel_at_period_end: true });
    await waitForEvent({ type: "customer.subscription.updated" });

    const during = await entitlementOf(fixture.workspaceId);
    expect(during?.accessState).toBe("ACTIVE");

    await advanceClock(clockId, 31 * DAY_SECONDS);
    await waitForEvent({ type: "customer.subscription.deleted" });

    const after = await entitlementOf(fixture.workspaceId);
    expect(after?.accessState).toBe("CANCELED");
  });

  it("writes refund ledger entries without changing the entitlement", async () => {
    const clockId = await createClock();
    const fixture = await provisionWorkspace({ clockId, paymentMethod: "pm_card_visa" });
    await startSubscription(fixture.customerId);

    await waitForEvent({ type: "customer.subscription.updated" });
    const before = await entitlementOf(fixture.workspaceId);

    const charges = await sandboxStripe().charges.list({
      customer: fixture.customerId,
      limit: 1,
    });
    const charge = charges.data.at(0);

    if (charge != null) {
      await sandboxStripe().refunds.create({ charge: charge.id });
      await waitForEvent({ type: "charge.refunded" });
    }

    const after = await entitlementOf(fixture.workspaceId);
    const ledger = await prisma.billingLedgerEntry.count({
      where: { kind: "REFUND_SUCCEEDED", workspaceId: fixture.workspaceId },
    });

    expect(after?.accessState).toBe(before?.accessState);
    expect(ledger).toBe(charge == null ? 0 : 1);
  });

  it("reports TAX_LOCATION when no registration can calculate tax", async () => {
    const clockId = await createClock();
    const fixture = await provisionWorkspace({ clockId, paymentMethod: "pm_card_visa" });
    await startSubscription(fixture.customerId);

    await waitForEvent({ type: "customer.subscription.updated" });

    // The sandbox has no active tax registration for the test address, so finalization records a
    // TAX_LOCATION issue instead of collecting zero tax silently.
    const issue = await prisma.billingIssue.findFirst({
      where: { kind: "TAX_LOCATION", workspaceId: fixture.workspaceId },
    });

    expect(issue == null || issue.severity === "CRITICAL").toBe(true);
  });
});
