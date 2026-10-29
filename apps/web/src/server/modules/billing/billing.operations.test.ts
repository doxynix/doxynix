import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { DbClient } from "@/server/core/db";

import {
  canonicalRequestHash,
  runBillingOperation,
  stripeIdempotencyKey,
} from "./billing.operations";

const WORKSPACE_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d";
const REQUEST_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5e";
const OPERATION_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a60";

type OperationRow = {
  errorCode: null | string;
  id: string;
  requestHash: string;
  resultJson: unknown;
  status: string;
  stripeObjectId: null | string;
};

function row(overrides: Partial<OperationRow> = {}): OperationRow {
  return {
    errorCode: null,
    id: OPERATION_ID,
    requestHash: "",
    resultJson: null,
    status: "STARTED",
    stripeObjectId: null,
    ...overrides,
  };
}

// The service only needs four delegate methods, but it is typed against Prisma's client so that
// BILL-06 can pass the real one; the fake is cast once, here, instead of at every call site.
function fakeDb(operations: {
  create?: unknown;
  findUnique?: unknown;
  update?: unknown;
  updateMany?: unknown;
}): DbClient {
  return { billingOperation: operations } as unknown as DbClient;
}

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields", {
    clientVersion: Prisma.prismaVersion.client,
    code: "P2002",
  });
}

const baseInput = {
  actorUserId: null,
  operation: "CHECKOUT_CREATE",
  requestBody: { quantity: 2 },
  requestId: REQUEST_ID,
  workspaceId: WORKSPACE_ID,
};

describe("billing operation idempotency", () => {
  it("runs the action once and replays the stored result for the same request", async () => {
    const requestHash = canonicalRequestHash(baseInput.requestBody);
    const execute = vi.fn(async () => ({
      result: { sessionId: "cs_1" },
      stripeObjectId: "cs_1",
    }));
    const create = vi
      .fn()
      .mockResolvedValueOnce(row({ requestHash }))
      .mockRejectedValueOnce(uniqueViolation());
    const findUnique = vi
      .fn()
      .mockResolvedValue(
        row({ requestHash, resultJson: { sessionId: "cs_1" }, status: "COMPLETED" }),
      );
    const update = vi.fn().mockResolvedValue(row({ requestHash, status: "COMPLETED" }));
    const db = fakeDb({ create, findUnique, update, updateMany: vi.fn() });

    const first = await runBillingOperation(db, { ...baseInput, execute });
    const second = await runBillingOperation(db, { ...baseInput, execute });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
    expect(first).toEqual({
      operationId: OPERATION_ID,
      replayed: false,
      result: { sessionId: "cs_1" },
    });
    expect(second).toEqual({
      operationId: OPERATION_ID,
      replayed: true,
      result: { sessionId: "cs_1" },
    });
  });

  it("rejects the same request id with a different body as a conflict", async () => {
    const execute = vi.fn();
    const create = vi.fn().mockRejectedValue(uniqueViolation());
    const findUnique = vi
      .fn()
      .mockResolvedValue(row({ requestHash: canonicalRequestHash({ quantity: 1 }) }));
    const db = fakeDb({ create, findUnique, update: vi.fn(), updateMany: vi.fn() });

    await expect(
      runBillingOperation(db, { ...baseInput, execute, requestBody: { quantity: 3 } }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "BILLING_IDEMPOTENCY_CONFLICT",
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it("lets only one of two concurrent calls run the action", async () => {
    const requestHash = canonicalRequestHash(baseInput.requestBody);
    const execute = vi.fn(async () => {
      await Promise.resolve();

      return { result: { sessionId: "cs_1" } };
    });
    const create = vi
      .fn()
      .mockResolvedValueOnce(row({ requestHash }))
      .mockRejectedValueOnce(uniqueViolation());
    const findUnique = vi.fn().mockResolvedValue(row({ requestHash }));
    const update = vi.fn().mockResolvedValue(row({ requestHash, status: "COMPLETED" }));
    const db = fakeDb({ create, findUnique, update, updateMany: vi.fn() });

    const results = await Promise.allSettled([
      runBillingOperation(db, { ...baseInput, execute }),
      runBillingOperation(db, { ...baseInput, execute }),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toMatchObject({ message: "BILLING_OPERATION_IN_PROGRESS" });
    expect(execute).toHaveBeenCalledTimes(1);
    // Two insert attempts, one accepted by the unique constraint: a single operation row.
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("stores a result without URLs, emails or amounts", async () => {
    const requestHash = canonicalRequestHash(baseInput.requestBody);
    const execute = vi.fn(async () => ({
      result: {
        amountTotal: 1900,
        checkoutUrl: "https://checkout.stripe.com/c/pay/cs_1",
        customerEmail: "alice@example.com",
        note: "write to alice@example.com",
        sessionId: "cs_1",
      },
    }));
    let stored: unknown;
    const create = vi.fn().mockResolvedValue(row({ requestHash }));
    const update = vi.fn(async (args: { data: { resultJson: unknown } }) => {
      stored = args.data.resultJson;

      return row({ requestHash, status: "COMPLETED" });
    });
    const db = fakeDb({ create, findUnique: vi.fn(), update, updateMany: vi.fn() });

    await runBillingOperation(db, { ...baseInput, execute });

    expect(stored).toEqual({ note: "[redacted]", sessionId: "cs_1" });
    expect(JSON.stringify(stored)).not.toContain("https://");
    expect(JSON.stringify(stored)).not.toContain("@");
  });

  it("allows one retry after a failure", async () => {
    const requestHash = canonicalRequestHash(baseInput.requestBody);
    const execute = vi.fn(async () => ({ result: { sessionId: "cs_2" } }));
    const create = vi.fn().mockRejectedValue(uniqueViolation());
    const findUnique = vi
      .fn()
      .mockResolvedValue(
        row({ errorCode: "BILLING_OPERATION_FAILED", requestHash, status: "FAILED" }),
      );
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const update = vi.fn().mockResolvedValue(row({ requestHash, status: "COMPLETED" }));
    const db = fakeDb({ create, findUnique, update, updateMany });

    const run = await runBillingOperation(db, { ...baseInput, execute });

    expect(run.replayed).toBe(false);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith({
      data: { errorCode: null, status: "STARTED" },
      where: { id: OPERATION_ID, status: "FAILED" },
    });
  });

  it("does not retry when another caller already resumed the failed operation", async () => {
    const requestHash = canonicalRequestHash(baseInput.requestBody);
    const execute = vi.fn();
    const create = vi.fn().mockRejectedValue(uniqueViolation());
    const findUnique = vi.fn().mockResolvedValue(row({ requestHash, status: "FAILED" }));
    const db = fakeDb({
      create,
      findUnique,
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    });

    await expect(runBillingOperation(db, { ...baseInput, execute })).rejects.toMatchObject({
      message: "BILLING_OPERATION_IN_PROGRESS",
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it("rejects a request id that is not a UUID", async () => {
    const db = fakeDb({});

    await expect(
      runBillingOperation(db, { ...baseInput, execute: vi.fn(), requestId: "not-a-uuid" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("canonicalRequestHash", () => {
  it("ignores object key order", () => {
    expect(canonicalRequestHash({ a: 1, b: { c: 2, d: 3 } })).toBe(
      canonicalRequestHash({ a: 1, b: { c: 2, d: 3 } }),
    );
  });

  it("changes when a value changes", () => {
    expect(canonicalRequestHash({ quantity: 1 })).not.toBe(canonicalRequestHash({ quantity: 2 }));
  });
});

describe("stripeIdempotencyKey", () => {
  it("builds a namespaced key from workspace and request ids", () => {
    const key = stripeIdempotencyKey({
      environment: "sandbox",
      operation: "checkout",
      requestId: REQUEST_ID,
      workspaceId: WORKSPACE_ID,
    });

    expect(key).toBe(`doxynix:sandbox:checkout:${WORKSPACE_ID}:${REQUEST_ID}`);
    expect(key.length).toBeLessThanOrEqual(255);
  });

  it("refuses a key longer than Stripe accepts", () => {
    expect(() =>
      stripeIdempotencyKey({
        environment: "x".repeat(300),
        operation: "checkout",
        requestId: REQUEST_ID,
        workspaceId: WORKSPACE_ID,
      }),
    ).toThrow(/255/);
  });

  it("refuses a key that contains an email address", () => {
    expect(() =>
      stripeIdempotencyKey({
        environment: "ops@example.com",
        operation: "checkout",
        requestId: REQUEST_ID,
        workspaceId: WORKSPACE_ID,
      }),
    ).toThrow(/email/i);
  });
});
