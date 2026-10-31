import { enhance } from "@zenstackhq/runtime";
import { beforeEach, describe, expect, it } from "vitest";

import { upsertBillingIssue } from "@/server/core/billing/issue";
import { prisma } from "@/server/core/db";
import { appendLedgerEntry } from "@/server/modules/billing/billing.ledger";

import {
  cleanupDatabase,
  createAnon,
  createBareTestUser,
  createTestUser,
  expectDenied,
} from "../helpers";

const OCCURRED_AT = new Date("2026-10-31T12:00:00.000Z");

function entry(workspaceId: string, overrides: Record<string, unknown> = {}) {
  return {
    amount: BigInt(-1900),
    currency: "usd",
    kind: "REFUND_SUCCEEDED",
    occurredAt: OCCURRED_AT,
    status: "succeeded",
    stripeObjectId: "re_1",
    workspaceId,
    ...overrides,
  };
}

describe("billing ledger against Postgres", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  it("keeps one row for parallel appends with the same natural key", async () => {
    const alice = await createTestUser("Alice");

    const [first, second] = await Promise.all([
      appendLedgerEntry(prisma, entry(alice.workspace.id)),
      appendLedgerEntry(prisma, entry(alice.workspace.id)),
    ]);

    const rows = await prisma.billingLedgerEntry.findMany({
      where: { workspaceId: alice.workspace.id },
    });

    expect([first, second].sort((left, right) => Number(left) - Number(right))).toEqual([
      false,
      true,
    ]);
    expect(rows).toHaveLength(1);
  });

  it("keeps the transaction usable after a duplicate append", async () => {
    const alice = await createTestUser("Alice");

    await prisma.$transaction(async (tx) => {
      const first = await appendLedgerEntry(tx, entry(alice.workspace.id));
      const duplicate = await appendLedgerEntry(tx, entry(alice.workspace.id));
      const other = await appendLedgerEntry(
        tx,
        entry(alice.workspace.id, { kind: "DISPUTE_OPENED", stripeObjectId: "dp_1" }),
      );

      expect([first, duplicate, other]).toEqual([true, false, true]);
    });

    await expect(
      prisma.billingLedgerEntry.count({ where: { workspaceId: alice.workspace.id } }),
    ).resolves.toBe(2);
  });

  it("denies ledger updates and deletes for owner, member and admin", async () => {
    const alice = await createTestUser("Alice");
    const bob = await createBareTestUser("Bob");
    const admin = await createTestUser("Admin", "ADMIN");

    await prisma.workspaceMember.create({
      data: { role: "MEMBER", userId: bob.user.id, workspaceId: alice.workspace.id },
    });

    const row = await prisma.billingLedgerEntry.create({
      data: {
        amount: BigInt(-1900),
        currency: "usd",
        entryKey: "REFUND_SUCCEEDED:re_policy:succeeded",
        kind: "REFUND_SUCCEEDED",
        occurredAt: OCCURRED_AT,
        stripeObjectId: "re_policy",
        workspaceId: alice.workspace.id,
      },
    });

    for (const user of [alice.user, bob.user, admin.user]) {
      const db = enhance(prisma, { user: { id: user.id, role: user.role } });

      await expectDenied(
        db.billingLedgerEntry.update({ data: { amount: BigInt(1) }, where: { id: row.id } }),
      );
      await expectDenied(db.billingLedgerEntry.delete({ where: { id: row.id } }));
    }

    const stored = await prisma.billingLedgerEntry.findUnique({ where: { id: row.id } });
    expect(stored?.amount).toBe(BigInt(-1900));
  });

  it("appends a correction without touching the original entry", async () => {
    const alice = await createTestUser("Alice");

    const original = await prisma.billingLedgerEntry.create({
      data: {
        amount: BigInt(1000),
        currency: "usd",
        entryKey: "INVOICE_PAID:in_correction:paid",
        kind: "INVOICE_PAID",
        occurredAt: OCCURRED_AT,
        stripeObjectId: "in_correction",
        workspaceId: alice.workspace.id,
      },
    });

    const created = await appendLedgerEntry(prisma, {
      amount: BigInt(200),
      correctsEntryId: original.id,
      currency: "usd",
      kind: "INVOICE_PAID_CORRECTION",
      occurredAt: OCCURRED_AT,
      status: "correction:200",
      stripeObjectId: "in_correction",
      workspaceId: alice.workspace.id,
    });

    const rows = await prisma.billingLedgerEntry.findMany({
      orderBy: { createdAt: "asc" },
      where: { stripeObjectId: "in_correction" },
    });

    expect(created).toBe(true);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.amount).toBe(BigInt(1000));
    expect(rows[0]?.correctsEntryId).toBeNull();
    expect(rows[1]?.correctsEntryId).toBe(original.id);
    expect(rows[1]?.amount).toBe(BigInt(200));
  });
});

describe("billing policies", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  it("scopes projections and entitlements by role", async () => {
    const alice = await createTestUser("Alice");
    const bob = await createBareTestUser("Bob");
    const admin = await createTestUser("Admin", "ADMIN");
    const anon = createAnon();

    await prisma.workspaceMember.create({
      data: { role: "MEMBER", userId: bob.user.id, workspaceId: alice.workspace.id },
    });
    await prisma.billingCustomer.create({
      data: {
        externalCustomerId: "cus_policy",
        livemode: false,
        provider: "stripe",
        workspaceId: alice.workspace.id,
      },
    });

    const bobDb = enhance(prisma, { user: { id: bob.user.id, role: bob.user.role } });

    await expect(alice.db.workspaceEntitlement.findMany()).resolves.toHaveLength(1);
    await expect(bobDb.workspaceEntitlement.findMany()).resolves.toHaveLength(1);
    await expect(alice.db.billingCustomer.findMany()).resolves.toHaveLength(1);
    await expect(bobDb.billingCustomer.findMany()).resolves.toHaveLength(0);
    await expect(anon.db.billingCustomer.findMany()).resolves.toHaveLength(0);
    await expect(admin.db.billingCustomer.findMany()).resolves.toHaveLength(1);

    await expectDenied(
      admin.db.workspaceEntitlement.update({
        data: { seatLimit: 99 },
        where: { workspaceId: alice.workspace.id },
      }),
    );
  });
});

describe("cleanup coverage", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  it("removes every billing and usage row between files", async () => {
    const alice = await createTestUser("Alice");
    const customer = await prisma.billingCustomer.create({
      data: {
        externalCustomerId: "cus_cleanup",
        livemode: false,
        provider: "stripe",
        workspaceId: alice.workspace.id,
      },
    });

    await prisma.billingEvent.create({
      data: {
        livemode: false,
        payloadHash: "hash",
        stripeCreatedAt: OCCURRED_AT,
        stripeEventId: "evt_cleanup",
        type: "invoice.paid",
      },
    });
    await prisma.billingSubscription.create({
      data: {
        billingCustomerId: customer.id,
        currency: "usd",
        currentPeriodEnd: OCCURRED_AT,
        currentPeriodStart: OCCURRED_AT,
        quantity: 1,
        stripePriceId: "price_cleanup",
        stripeStatus: "active",
        stripeSubscriptionId: "sub_cleanup",
        stripeSubscriptionItemId: "si_cleanup",
        workspaceId: alice.workspace.id,
      },
    });
    await appendLedgerEntry(prisma, entry(alice.workspace.id));
    await prisma.billingIssue.create({
      data: { dedupeKey: "cleanup", kind: "TEST", severity: "INFO", source: "test" },
    });
    await prisma.usageEvent.create({
      data: {
        idempotencyKey: "cleanup-usage",
        kind: "ANALYSIS",
        occurredAt: OCCURRED_AT,
        workspaceId: alice.workspace.id,
      },
    });
    await prisma.workspaceUsage.create({
      data: { periodStart: OCCURRED_AT, workspaceId: alice.workspace.id },
    });

    await cleanupDatabase();

    const counts = await Promise.all([
      prisma.billingEvent.count(),
      prisma.billingCustomer.count(),
      prisma.billingSubscription.count(),
      prisma.billingLedgerEntry.count(),
      prisma.billingIssue.count(),
      prisma.usageEvent.count(),
      prisma.workspaceUsage.count(),
      prisma.workspaceEntitlement.count(),
    ]);

    expect(counts).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("keeps the transaction usable after a duplicate issue write", async () => {
    const alice = await createTestUser("Alice");
    const issue = {
      dedupeKey: "duplicate-issue",
      details: {},
      kind: "UNOWNED_STRIPE_OBJECT",
      severity: "CRITICAL" as const,
      source: "test",
    };

    await prisma.$transaction(async (tx) => {
      await upsertBillingIssue(tx, issue);
      await upsertBillingIssue(tx, issue);
      await appendLedgerEntry(tx, entry(alice.workspace.id, { stripeObjectId: "re_issue" }));
    });

    const issues = await prisma.billingIssue.count({ where: { dedupeKey: "duplicate-issue" } });
    const ledger = await prisma.billingLedgerEntry.count({
      where: { workspaceId: alice.workspace.id },
    });

    expect(issues).toBe(1);
    expect(ledger).toBe(1);
  });
});
