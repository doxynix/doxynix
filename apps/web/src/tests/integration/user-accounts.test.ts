import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/core/db";
import { userService } from "@/server/modules/users/user.service";

import { cleanupDatabase, createAnon, createTestUser, expectDenied } from "../helpers";

type Rejection = { ctor: string; code: unknown; message: string };

function toRejection(error: unknown): Rejection {
  const e = error as { code?: unknown; constructor?: { name?: string }; message?: unknown };
  return {
    code: e.code,
    ctor: e.constructor?.name ?? "unknown",
    message: String(e.message ?? error)
      .slice(0, 1500)
      .replaceAll("\n", " "),
  };
}

async function captureRejection(promise: Promise<unknown>): Promise<Rejection> {
  try {
    await promise;
  } catch (error) {
    return toRejection(error);
  }
  throw new Error("expected the call to reject, but it resolved");
}

async function linkAccount(userId: string, providerId: string, accountId: string) {
  return prisma.account.create({ data: { accountId, providerId, userId } });
}

const providersOf = (userId: string) =>
  prisma.account.findMany({
    orderBy: { providerId: "asc" },
    select: { providerId: true },
    where: { userId },
  });

describe("User Linked Accounts: disconnectAccount inside the enhanced $transaction", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  it("propagates auth() into the interactive $transaction and enforces read and write policies there", async () => {
    const alice = await createTestUser("Alice");
    const bob = await createTestUser("Bob");
    const admin = await createTestUser("Admin", "ADMIN");
    const account = await linkAccount(alice.user.id, "github", "gh_alice_mech");

    await expect(
      alice.db.$transaction((tx) =>
        tx.user.findUnique({ select: { id: true }, where: { id: alice.user.id } }),
      ),
    ).resolves.toMatchObject({ id: alice.user.id });

    await expect(
      admin.db.$transaction((tx) =>
        tx.user.findUnique({ select: { id: true }, where: { id: alice.user.id } }),
      ),
    ).resolves.toMatchObject({ id: alice.user.id });

    await expect(
      createAnon().db.$transaction((tx) =>
        tx.user.findUnique({ select: { id: true }, where: { id: alice.user.id } }),
      ),
    ).resolves.toBeNull();

    await expect(
      bob.db.$transaction((tx) =>
        tx.account.findUnique({
          where: { userId_providerId: { providerId: "github", userId: alice.user.id } },
        }),
      ),
    ).resolves.toBeNull();

    const denied = await captureRejection(
      bob.db.$transaction((tx) => tx.account.delete({ where: { id: account.id } })),
    );
    expect(denied.code).toBe("P2004");
    expect(denied.message).toMatch(/denied by policy/i);

    await expect(providersOf(alice.user.id)).resolves.toEqual([{ providerId: "github" }]);
  });

  it("denies user B the ability to disconnect user A's provider", async () => {
    const alice = await createTestUser("Alice");
    const bob = await createTestUser("Bob");
    await linkAccount(alice.user.id, "github", "gh_alice_cross");
    await linkAccount(alice.user.id, "google", "go_alice_cross");

    await expectDenied(userService.disconnectAccount(bob.db, alice.user.id, "github"));

    const rejection = await captureRejection(
      userService.disconnectAccount(bob.db, alice.user.id, "github"),
    );
    expect(rejection.ctor).toBe("TRPCError");
    expect(rejection.code).toBe("NOT_FOUND");

    await expect(providersOf(alice.user.id)).resolves.toEqual([
      { providerId: "github" },
      { providerId: "google" },
    ]);
  });

  it("still lets an ADMIN disconnect another user's provider", async () => {
    const alice = await createTestUser("Alice");
    const admin = await createTestUser("Admin", "ADMIN");
    await linkAccount(alice.user.id, "github", "gh_alice_admin");
    await linkAccount(alice.user.id, "google", "go_alice_admin");

    await expect(userService.disconnectAccount(admin.db, alice.user.id, "github")).resolves.toEqual(
      {
        success: true,
      },
    );

    await expect(providersOf(alice.user.id)).resolves.toEqual([{ providerId: "google" }]);
  });

  it("allows a user to disconnect one of their own providers", async () => {
    const alice = await createTestUser("Alice");
    await linkAccount(alice.user.id, "github", "gh_alice_self");
    await linkAccount(alice.user.id, "google", "go_alice_self");

    await expect(userService.disconnectAccount(alice.db, alice.user.id, "github")).resolves.toEqual(
      {
        success: true,
      },
    );

    await expect(providersOf(alice.user.id)).resolves.toEqual([{ providerId: "google" }]);
  });

  it("refuses to disconnect the only provider when the email is not verified", async () => {
    const alice = await createTestUser("Alice");
    await linkAccount(alice.user.id, "github", "gh_alice_last");

    expect(alice.user.emailVerified).toBe(false);

    const rejection = await captureRejection(
      userService.disconnectAccount(alice.db, alice.user.id, "github"),
    );
    expect(rejection.ctor).toBe("TRPCError");
    expect(rejection.code).toBe("BAD_REQUEST");
    expect(rejection.message).toMatch(/only authentication method/i);

    await expect(providersOf(alice.user.id)).resolves.toEqual([{ providerId: "github" }]);
  });

  it("allows disconnecting the only provider once the email is verified", async () => {
    const alice = await createTestUser("Alice");
    await prisma.user.update({ data: { emailVerified: true }, where: { id: alice.user.id } });
    await linkAccount(alice.user.id, "github", "gh_alice_verified");

    await expect(userService.disconnectAccount(alice.db, alice.user.id, "github")).resolves.toEqual(
      {
        success: true,
      },
    );

    await expect(providersOf(alice.user.id)).resolves.toEqual([]);
  });

  it("returns NOT_FOUND for a provider the user never linked, mutating nothing", async () => {
    const alice = await createTestUser("Alice");
    await linkAccount(alice.user.id, "github", "gh_alice_unknown");
    await linkAccount(alice.user.id, "google", "go_alice_unknown");

    const rejection = await captureRejection(
      userService.disconnectAccount(alice.db, alice.user.id, "yandex"),
    );
    expect(rejection.ctor).toBe("TRPCError");
    expect(rejection.code).toBe("NOT_FOUND");

    await expect(providersOf(alice.user.id)).resolves.toEqual([
      { providerId: "github" },
      { providerId: "google" },
    ]);
  });

  it("returns NOT_FOUND when the provider is already disconnected", async () => {
    const alice = await createTestUser("Alice");
    await linkAccount(alice.user.id, "github", "gh_alice_twice");
    await linkAccount(alice.user.id, "google", "go_alice_twice");

    await expect(userService.disconnectAccount(alice.db, alice.user.id, "github")).resolves.toEqual(
      {
        success: true,
      },
    );

    const rejection = await captureRejection(
      userService.disconnectAccount(alice.db, alice.user.id, "github"),
    );
    expect(rejection.ctor).toBe("TRPCError");
    expect(rejection.code).toBe("NOT_FOUND");

    await expect(providersOf(alice.user.id)).resolves.toEqual([{ providerId: "google" }]);
  });

  it("recovers the losing side of a concurrent disconnect into NOT_FOUND, not P2034", async () => {
    const alice = await createTestUser("Alice");
    await linkAccount(alice.user.id, "github", "gh_alice_race");
    await linkAccount(alice.user.id, "google", "go_alice_race");

    const results = await Promise.allSettled([
      userService.disconnectAccount(alice.db, alice.user.id, "github"),
      userService.disconnectAccount(alice.db, alice.user.id, "github"),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const loser = toRejection((rejected[0] as PromiseRejectedResult).reason);
    expect(loser.ctor).toBe("TRPCError");
    expect(loser.code).toBe("NOT_FOUND");
    expect(loser.message).toMatch(/already disconnected/i);
    expect(loser.message).not.toMatch(/write conflict or a deadlock/i);

    await expect(providersOf(alice.user.id)).resolves.toEqual([{ providerId: "google" }]);
  });

  it("propagates TRPCError instances that survive the Prisma transaction boundary", async () => {
    const alice = await createTestUser("Alice");
    await linkAccount(alice.user.id, "github", "gh_alice_trpc");

    const thrown = await userService
      .disconnectAccount(alice.db, alice.user.id, "github")
      .then(() => null)
      .catch((error: unknown) => error);

    expect(thrown).toBeInstanceOf(TRPCError);
    expect((thrown as TRPCError).code).toBe("BAD_REQUEST");
  });
});
