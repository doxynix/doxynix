import { describe, expect, it, vi } from "vitest";

import { type DbClient, withAdvisoryLock, withTransaction } from "./db";

type Statement = { sql: string; values: readonly unknown[] };

function transactionClient() {
  return { $queryRawTyped: vi.fn(async (_query: Statement) => []) };
}

function rootClient() {
  const tx = transactionClient();
  const $transaction = vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx));

  return { $transaction, client: { ...tx, $transaction } as unknown as DbClient, tx };
}

describe("withTransaction", () => {
  it("runs inline when the client is already a transaction", async () => {
    const tx = transactionClient();
    const fn = vi.fn(async (_client: DbClient) => "inline");

    await expect(withTransaction(tx as unknown as DbClient, fn)).resolves.toBe("inline");

    // A nested `$transaction` would commit outside the caller's block, so the callback gets the
    // transaction client itself.
    expect(fn).toHaveBeenCalledWith(tx);
  });

  it("opens a transaction on the root client", async () => {
    const { $transaction, client, tx } = rootClient();
    const fn = vi.fn(async (_client: DbClient) => "committed");

    await expect(withTransaction(client, fn)).resolves.toBe("committed");

    expect($transaction).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(tx);
  });
});

describe("withAdvisoryLock", () => {
  it("takes the lock inside one transaction and returns the callback result", async () => {
    const { $transaction, client, tx } = rootClient();

    const result = await withAdvisoryLock(client, "workspace-1", async (inner) =>
      inner === (tx as unknown as typeof inner) ? "locked" : "wrong client",
    );

    expect(result).toBe("locked");
    expect($transaction).toHaveBeenCalledTimes(1);

    const [statement] = tx.$queryRawTyped.mock.calls[0] as [Statement];
    expect(statement.sql).toContain("pg_advisory_xact_lock");
    expect(statement.values).toEqual(["workspace-1"]);
    expect(tx.$queryRawTyped).toHaveBeenCalledTimes(1);
  });

  it("reuses the caller's transaction instead of opening a second one", async () => {
    const tx = transactionClient();

    await withAdvisoryLock(tx as unknown as DbClient, "user-1", async () => undefined);

    expect(tx.$queryRawTyped).toHaveBeenCalledTimes(1);
  });

  it("propagates a callback failure so the lock is released with the rollback", async () => {
    const { client } = rootClient();

    await expect(
      withAdvisoryLock(client, "workspace-1", async () => {
        throw new Error("seat limit");
      }),
    ).rejects.toThrow("seat limit");
  });
});
