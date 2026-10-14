import { getAccountForUpdate } from "@prisma/client/sql";
import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/core/db";

import { cleanupDatabase, createTestUser } from "../helpers";

// `NOWAIT` turns a held write lock into SQLSTATE 55P03 ("could not obtain lock on row") instead of
// a wait, which is what makes the lock observable: a plain `SELECT` resolves and the test fails.
const lockRowNow = (id: string) =>
  prisma.$queryRawUnsafe("SELECT id FROM accounts WHERE id = $1::uuid FOR UPDATE NOWAIT;", id);

async function seedAccount(userId: string, providerId: string, accountId: string) {
  return prisma.account.create({ data: { accountId, providerId, userId } });
}

describe("getAccountForUpdate", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  it("holds a write lock on the addressed row", async () => {
    const alice = await createTestUser("Alice");
    const account = await seedAccount(alice.user.id, "github", "gh_locked");

    await prisma.$transaction(async (tx) => {
      await tx.$queryRawTyped(getAccountForUpdate(alice.user.id, "github"));

      await expect(lockRowNow(account.id)).rejects.toThrow(/lock/i);
    });
  });

  it("does not lock a row belonging to another provider", async () => {
    const alice = await createTestUser("Alice");
    const github = await seedAccount(alice.user.id, "github", "gh_target");
    const google = await seedAccount(alice.user.id, "google", "go_untouched");

    await prisma.$transaction(async (tx) => {
      await tx.$queryRawTyped(getAccountForUpdate(alice.user.id, "github"));

      await expect(lockRowNow(github.id)).rejects.toThrow(/lock/i);
      await expect(lockRowNow(google.id)).resolves.toBeDefined();
    });
  });

  it("returns no row when the account is absent", async () => {
    const alice = await createTestUser("Nobody");

    const rows = await prisma.$queryRawTyped(getAccountForUpdate(alice.user.id, "github"));

    expect(rows).toHaveLength(0);
  });

  it("returns the id of the addressed account", async () => {
    const alice = await createTestUser("Reader");
    const account = await seedAccount(alice.user.id, "github", "gh_returned");

    const rows = await prisma.$queryRawTyped(getAccountForUpdate(alice.user.id, "github"));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(account.id);
  });
});
