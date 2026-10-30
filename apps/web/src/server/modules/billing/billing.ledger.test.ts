import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DbClient } from "@/server/core/db";

import { appendLedgerEntry, ledgerEntryKey } from "./billing.ledger";

const WORKSPACE_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d";
const OCCURRED_AT = new Date("2026-10-30T12:00:00.000Z");

type LedgerRow = {
  amount: bigint;
  currency: string;
  entryKey: string;
  kind: string;
  stripeObjectId: string;
};

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields", {
    clientVersion: Prisma.prismaVersion.client,
    code: "P2002",
  });
}

function createDb() {
  const rows = new Map<string, LedgerRow>();

  const db = {
    billingLedgerEntry: {
      create: vi.fn(async ({ data }: { data: LedgerRow }) => {
        if (rows.has(data.entryKey)) {
          throw uniqueViolation();
        }

        rows.set(data.entryKey, data);

        return data;
      }),
    },
  };

  return { db: db as unknown as DbClient, rows };
}

describe("ledgerEntryKey", () => {
  it("builds the natural key from kind, object and status", () => {
    expect(ledgerEntryKey("INVOICE_PAID", "in_1", "paid")).toBe("INVOICE_PAID:in_1:paid");
  });
});

describe("appendLedgerEntry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("appends a signed entry with its natural key", async () => {
    const fake = createDb();

    const appended = await appendLedgerEntry(fake.db, {
      amount: BigInt(1900),
      currency: "usd",
      kind: "INVOICE_PAID",
      occurredAt: OCCURRED_AT,
      relatedInvoiceId: "in_1",
      status: "paid",
      stripeObjectId: "in_1",
      workspaceId: WORKSPACE_ID,
    });

    expect(appended).toBe(true);
    expect(fake.rows.get("INVOICE_PAID:in_1:paid")).toMatchObject({
      amount: BigInt(1900),
      currency: "usd",
      kind: "INVOICE_PAID",
      stripeObjectId: "in_1",
    });
  });

  it("does not duplicate a replayed object in the same state", async () => {
    const fake = createDb();
    const input = {
      amount: BigInt(1900),
      currency: "usd",
      kind: "INVOICE_PAID",
      occurredAt: OCCURRED_AT,
      status: "paid",
      stripeObjectId: "in_1",
      workspaceId: WORKSPACE_ID,
    };

    const first = await appendLedgerEntry(fake.db, input);
    const second = await appendLedgerEntry(fake.db, input);

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(fake.rows.size).toBe(1);
  });

  it("appends a separate entry for a different status", async () => {
    const fake = createDb();
    const base = {
      amount: BigInt(1900),
      currency: "usd",
      kind: "REFUND_SUCCEEDED",
      occurredAt: OCCURRED_AT,
      stripeObjectId: "re_1",
      workspaceId: WORKSPACE_ID,
    };

    await appendLedgerEntry(fake.db, { ...base, status: "pending" });
    await appendLedgerEntry(fake.db, { ...base, status: "succeeded" });

    expect(fake.rows.size).toBe(2);
  });
});
