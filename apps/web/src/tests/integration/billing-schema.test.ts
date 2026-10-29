import { Prisma } from "@prisma/client";
import { enhance } from "@zenstackhq/runtime";
import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/core/db";

import {
  cleanupDatabase,
  createAnon,
  createBareTestUser,
  createTestUser,
  expectDenied,
} from "../helpers";

type ColumnRow = {
  column_default: null | string;
  column_name: string;
  data_type: string;
  is_nullable: string;
};

const BILLING_TABLES = [
  "billing_checkout_sessions",
  "billing_customers",
  "billing_events",
  "billing_issues",
  "billing_ledger_entries",
  "billing_operations",
  "billing_reconciliation_runs",
  "billing_subscriptions",
] as const;

async function columnsFor(table: string): Promise<Array<ColumnRow>> {
  return prisma.$queryRaw<Array<ColumnRow>>`
    SELECT column_name::text, data_type::text, is_nullable::text, column_default::text
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table}
  `;
}

async function createCustomer(workspaceId: string, stripeCustomerId = "cus_test_1") {
  return prisma.billingCustomer.create({
    data: { livemode: false, stripeCustomerId, workspaceId },
  });
}

function subscriptionData(billingCustomerId: string, workspaceId: string, overrides = {}) {
  return {
    billingCustomerId,
    currency: "usd",
    currentPeriodEnd: new Date("2026-11-29T00:00:00.000Z"),
    currentPeriodStart: new Date("2026-10-29T00:00:00.000Z"),
    quantity: 1,
    stripePriceId: "price_pro_monthly_usd",
    stripeStatus: "active",
    stripeSubscriptionId: `sub_${Math.random().toString(36).slice(2)}`,
    stripeSubscriptionItemId: `si_${Math.random().toString(36).slice(2)}`,
    workspaceId,
    ...overrides,
  };
}

describe("billing schema", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  it("creates every billing table with a uuidv7 primary key and timezone-aware timestamps", async () => {
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name::text FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY(${BILLING_TABLES}::text[])
    `;

    expect(tables.map((table) => table.table_name).toSorted()).toEqual([...BILLING_TABLES]);

    for (const table of BILLING_TABLES) {
      const columns = await columnsFor(table);
      const id = columns.find((column) => column.column_name === "id");
      const createdAt = columns.find((column) => column.column_name === "created_at");

      expect(id?.data_type).toBe("uuid");
      expect(id?.column_default).toContain("uuidv7");
      expect(createdAt?.data_type).toBe("timestamp with time zone");
      expect(createdAt?.is_nullable).toBe("NO");
    }
  });

  it("allows one current subscription per workspace and keeps history", async () => {
    const alice = await createTestUser("Alice");
    const customer = await createCustomer(alice.workspace.id);

    const oldSubscription = await prisma.billingSubscription.create({
      data: subscriptionData(customer.id, alice.workspace.id, { isCurrent: null }),
    });
    const currentSubscription = await prisma.billingSubscription.create({
      data: subscriptionData(customer.id, alice.workspace.id, { isCurrent: true }),
    });

    expect(oldSubscription.isCurrent).toBeNull();
    expect(currentSubscription.isCurrent).toBe(true);

    await expect(
      prisma.billingSubscription.create({
        data: subscriptionData(customer.id, alice.workspace.id, { isCurrent: true }),
      }),
    ).rejects.toThrow(/unique/i);

    const history = await prisma.billingSubscription.findMany({
      where: { workspaceId: alice.workspace.id },
    });
    expect(history).toHaveLength(2);
  });

  it("accepts unknown Stripe statuses and prices", async () => {
    const alice = await createTestUser("Alice");
    const customer = await createCustomer(alice.workspace.id);

    const subscription = await prisma.billingSubscription.create({
      data: subscriptionData(customer.id, alice.workspace.id, {
        stripePriceId: "price_from_a_future_catalog",
        stripeStatus: "some_future_status",
      }),
    });

    expect(subscription.stripeStatus).toBe("some_future_status");
    expect(subscription.stripePriceId).toBe("price_from_a_future_catalog");
  });

  it("keeps the Stripe event id unique after the payload is purged", async () => {
    const event = await prisma.billingEvent.create({
      data: {
        livemode: false,
        payload: { id: "evt_purge" },
        payloadHash: "hash",
        stripeCreatedAt: new Date("2026-10-29T00:00:00.000Z"),
        stripeEventId: "evt_purge",
        type: "invoice.paid",
      },
    });

    const purged = await prisma.billingEvent.update({
      data: { payload: Prisma.DbNull },
      where: { id: event.id },
    });
    const rows = await prisma.$queryRaw<Array<{ payload: unknown; stripe_event_id: string }>>`
      SELECT payload, stripe_event_id FROM billing_events WHERE id = ${event.id}::uuid
    `;

    expect(rows[0]?.payload).toBeNull();
    expect(rows[0]?.stripe_event_id).toBe("evt_purge");
    expect(purged.stripeEventId).toBe("evt_purge");

    await expect(
      prisma.billingEvent.create({
        data: {
          livemode: false,
          payloadHash: "other-hash",
          stripeCreatedAt: new Date("2026-10-29T00:00:01.000Z"),
          stripeEventId: "evt_purge",
          type: "invoice.paid",
        },
      }),
    ).rejects.toThrow(/unique/i);
  });

  it("denies ledger writes and lets the owner read its workspace ledger", async () => {
    const alice = await createTestUser("Alice");
    const entry = await prisma.billingLedgerEntry.create({
      data: {
        amount: BigInt(1900),
        currency: "usd",
        entryKey: "INVOICE_PAID:in_test_1:paid",
        kind: "INVOICE_PAID",
        occurredAt: new Date("2026-10-29T00:00:00.000Z"),
        stripeObjectId: "in_test_1",
        workspaceId: alice.workspace.id,
      },
    });

    const visible = await alice.db.billingLedgerEntry.findMany({
      where: { workspaceId: alice.workspace.id },
    });
    expect(visible.map((row) => row.id)).toEqual([entry.id]);

    await expectDenied(
      alice.db.billingLedgerEntry.update({
        data: { amount: BigInt(1) },
        where: { id: entry.id },
      }),
    );
    await expectDenied(alice.db.billingLedgerEntry.delete({ where: { id: entry.id } }));
    await expectDenied(
      alice.db.billingLedgerEntry.create({
        data: {
          amount: BigInt(1),
          currency: "usd",
          entryKey: "FORGED",
          kind: "INVOICE_PAID",
          occurredAt: new Date(),
          stripeObjectId: "in_forged",
          workspaceId: alice.workspace.id,
        },
      }),
    );

    const stored = await prisma.billingLedgerEntry.findUnique({ where: { id: entry.id } });
    expect(stored?.amount).toBe(BigInt(1900));
  });

  it("scopes billing projections to workspace owners and global admins", async () => {
    const alice = await createTestUser("Alice");
    const bob = await createBareTestUser("Bob");
    const admin = await createTestUser("Admin", "ADMIN");
    const anon = createAnon();

    await prisma.workspaceMember.create({
      data: { role: "MEMBER", userId: bob.user.id, workspaceId: alice.workspace.id },
    });
    await createCustomer(alice.workspace.id);

    const bobDb = enhance(prisma, { user: { id: bob.user.id, role: bob.user.role } });

    await expect(bobDb.billingCustomer.findMany()).resolves.toHaveLength(0);
    await expect(anon.db.billingCustomer.findMany()).resolves.toHaveLength(0);
    await expect(alice.db.billingCustomer.findMany()).resolves.toHaveLength(1);
    await expect(admin.db.billingCustomer.findMany()).resolves.toHaveLength(1);
  });

  it("keeps raw webhook events readable by admins only", async () => {
    const alice = await createTestUser("Alice");
    const admin = await createTestUser("Admin", "ADMIN");

    await prisma.billingEvent.create({
      data: {
        livemode: false,
        payload: { id: "evt_admin_only" },
        payloadHash: "hash",
        stripeCreatedAt: new Date("2026-10-29T00:00:00.000Z"),
        stripeEventId: "evt_admin_only",
        type: "customer.subscription.updated",
      },
    });

    await expect(alice.db.billingEvent.findMany()).resolves.toHaveLength(0);
    await expect(admin.db.billingEvent.findMany()).resolves.toHaveLength(1);
  });

  it("truncates billing tables through cleanupDatabase", async () => {
    const alice = await createTestUser("Alice");
    const customer = await createCustomer(alice.workspace.id);

    await prisma.billingSubscription.create({
      data: subscriptionData(customer.id, alice.workspace.id, { isCurrent: true }),
    });
    await prisma.billingIssue.create({
      data: {
        dedupeKey: "issue-1",
        kind: "MISMATCH",
        severity: "CRITICAL",
        source: "reconciliation",
      },
    });
    await prisma.billingReconciliationRun.create({
      data: { scheduledForDate: new Date("2026-10-29"), startedAt: new Date(), status: "SUCCESS" },
    });

    await cleanupDatabase();

    await expect(prisma.billingSubscription.count()).resolves.toBe(0);
    await expect(prisma.billingCustomer.count()).resolves.toBe(0);
    await expect(prisma.billingIssue.count()).resolves.toBe(0);
    await expect(prisma.billingReconciliationRun.count()).resolves.toBe(0);
  });
});
