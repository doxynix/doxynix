import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";

import type { DbClient, PrismaClientExtended } from "@/server/core/db";
import { prisma } from "@/server/core/db";
import { userService } from "@/server/modules/users/user.service";

import { cleanupDatabase, createTestUser } from "../helpers";

const MAX_ATTEMPTS = 3;

function writeConflict() {
  return new Prisma.PrismaClientKnownRequestError(
    "Transaction failed due to a write conflict or a deadlock",
    { clientVersion: Prisma.prismaVersion.client, code: "P2034" },
  );
}

function scriptedDb(real: unknown, failures: Error[]) {
  const attemptLog: number[] = [];
  let attempt = 0;

  const db = {
    $transaction(body: never, options: never) {
      attempt += 1;
      attemptLog.push(attempt);

      const failure = failures.shift();
      if (failure != null) {
        return Promise.reject(failure);
      }

      return (real as PrismaClientExtended).$transaction(body, options);
    },
  } as unknown as DbClient;

  return { attemptLog, db };
}

const providersOf = (userId: string) =>
  prisma.account.findMany({
    orderBy: { providerId: "asc" },
    select: { providerId: true },
    where: { userId },
  });

describe("disconnectAccount: bounded P2034 retry", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  it("re-runs the transaction after a P2034 and succeeds on the second attempt", async () => {
    const alice = await createTestUser("Alice");
    await prisma.account.create({
      data: { accountId: "gh_retry_ok", providerId: "github", userId: alice.user.id },
    });
    await prisma.account.create({
      data: { accountId: "go_retry_ok", providerId: "google", userId: alice.user.id },
    });

    const { attemptLog, db } = scriptedDb(alice.db, [writeConflict()]);

    await expect(userService.disconnectAccount(db, alice.user.id, "github")).resolves.toEqual({
      success: true,
    });

    expect(attemptLog).toEqual([1, 2]);
    await expect(providersOf(alice.user.id)).resolves.toEqual([{ providerId: "google" }]);
  });

  it("gives up after 3 attempts and surfaces a TRPCError, never a raw Prisma error", async () => {
    const alice = await createTestUser("Alice");
    await prisma.account.create({
      data: { accountId: "gh_retry_exhausted", providerId: "github", userId: alice.user.id },
    });
    await prisma.account.create({
      data: { accountId: "go_retry_exhausted", providerId: "google", userId: alice.user.id },
    });

    const { attemptLog, db } = scriptedDb(alice.db, [
      writeConflict(),
      writeConflict(),
      writeConflict(),
      writeConflict(),
    ]);

    const thrown = await userService
      .disconnectAccount(db, alice.user.id, "github")
      .then(() => null)
      .catch((error: unknown) => error);

    expect(attemptLog).toHaveLength(MAX_ATTEMPTS);
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as { code?: unknown }).code).toBe("BAD_REQUEST");
    expect((thrown as { code?: unknown }).code).not.toBe("P2034");
    expect(String((thrown as Error).message)).toMatch(/modified by another request/i);

    await expect(providersOf(alice.user.id)).resolves.toEqual([
      { providerId: "github" },
      { providerId: "google" },
    ]);
  });

  it("does not retry a non-P2034 Prisma error", async () => {
    const alice = await createTestUser("Alice");
    await prisma.account.create({
      data: { accountId: "gh_no_retry", providerId: "github", userId: alice.user.id },
    });

    const p2025 = new Prisma.PrismaClientKnownRequestError("Record to delete does not exist", {
      clientVersion: Prisma.prismaVersion.client,
      code: "P2025",
    });
    const { attemptLog, db } = scriptedDb(alice.db, [p2025]);

    const thrown = await userService
      .disconnectAccount(db, alice.user.id, "github")
      .then(() => null)
      .catch((error: unknown) => error);

    expect(attemptLog).toHaveLength(1);
    expect((thrown as { code?: unknown }).code).toBe("NOT_FOUND");
    expect(String((thrown as Error).message)).toMatch(/record not found/i);
  });

  it("does not retry, swallow, or re-wrap a TRPCError thrown inside the transaction", async () => {
    const alice = await createTestUser("Alice");
    await prisma.account.create({
      data: { accountId: "gh_trpc_thrown", providerId: "github", userId: alice.user.id },
    });
    expect(alice.user.emailVerified).toBe(false);

    const { attemptLog: badRequestLog, db: badRequestDb } = scriptedDb(alice.db, []);
    const badRequest = await userService
      .disconnectAccount(badRequestDb, alice.user.id, "github")
      .then(() => null)
      .catch((error: unknown) => error);

    expect(badRequestLog).toHaveLength(1);
    expect((badRequest as { code?: unknown }).code).toBe("BAD_REQUEST");
    expect(String((badRequest as Error).message)).toMatch(/only authentication method/i);

    await prisma.account.create({
      data: { accountId: "go_trpc_thrown", providerId: "google", userId: alice.user.id },
    });
    const { attemptLog: notFoundLog, db: notFoundDb } = scriptedDb(alice.db, []);
    const notFound = await userService
      .disconnectAccount(notFoundDb, alice.user.id, "yandex")
      .then(() => null)
      .catch((error: unknown) => error);

    expect(notFoundLog).toHaveLength(1);
    expect((notFound as { code?: unknown }).code).toBe("NOT_FOUND");
    expect(String((notFound as Error).message)).toBe("Account not found or already disconnected.");
    await expect(providersOf(alice.user.id)).resolves.toEqual([
      { providerId: "github" },
      { providerId: "google" },
    ]);
  });
});
