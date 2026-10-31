import { beforeEach, describe, expect, it } from "vitest";

import { upsertBillingIssue } from "@/server/core/billing/issue";
import { prisma } from "@/server/core/db";
import { appendLedgerEntry } from "@/server/modules/billing/billing.ledger";

import { cleanupDatabase, createTestUser } from "../helpers";

const OCCURRED_AT = new Date("2026-10-30T12:00:00.000Z");

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

describe("ledger idempotency inside a transaction", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  it("does not abort the transaction when the same entry is appended twice", async () => {
    const alice = await createTestUser("Alice");

    const result = await prisma.$transaction(async (tx) => {
      const first = await appendLedgerEntry(tx, entry(alice.workspace.id));
      const second = await appendLedgerEntry(tx, entry(alice.workspace.id));
      const third = await appendLedgerEntry(
        tx,
        entry(alice.workspace.id, {
          kind: "DISPUTE_OPENED",
          status: "needs_response",
          stripeObjectId: "dp_1",
        }),
      );

      return { first, second, third };
    });

    const rows = await prisma.billingLedgerEntry.findMany({
      where: { workspaceId: alice.workspace.id },
    });

    expect(result).toEqual({ first: true, second: false, third: true });
    expect(rows).toHaveLength(2);
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
      await appendLedgerEntry(tx, entry(alice.workspace.id, { stripeObjectId: "re_2" }));
    });

    const issues = await prisma.billingIssue.count({ where: { dedupeKey: "duplicate-issue" } });
    const ledger = await prisma.billingLedgerEntry.count({
      where: { workspaceId: alice.workspace.id },
    });

    expect(issues).toBe(1);
    expect(ledger).toBe(1);
  });
});
