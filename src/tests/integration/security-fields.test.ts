import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/shared/api/db/db";

import { cleanupDatabase, createAnon, createTestUser, expectDenied } from "../helpers";

describe("Field-Level Security (Omit, Immutable, Mass Assignment)", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  it("should hide @omit fields (tokens, secrets) from ZenStack", async () => {
    const alice = await createTestUser("Alice");

    const key = await alice.db.apiKey.create({
      data: { name: "k", prefix: "p", hashedKey: "SECRET_HASH", userId: alice.user.id },
    });
    const fetchedKey = await alice.db.apiKey.findUnique({ where: { id: key.id } });
    expect(fetchedKey).not.toHaveProperty("hashedKey");

    await prisma.session.create({
      data: { sessionToken: "SESS_SECRET", userId: alice.user.id, expires: new Date() },
    });
    const fetchedSession = await alice.db.session.findUnique({
      where: { sessionToken: "SESS_SECRET" },
    });
    expect(fetchedSession).not.toHaveProperty("sessionToken");

    await prisma.account.create({
      data: {
        userId: alice.user.id,
        type: "oauth",
        provider: "gh",
        providerAccountId: "1",
        access_token: "ACC_TOK",
      },
    });
    const fetchedAccount = await alice.db.account.findUnique({
      where: { provider_providerAccountId: { provider: "gh", providerAccountId: "1" } },
    });
    expect(fetchedAccount).not.toHaveProperty("access_token");
  });

  it("should prevent Mass Assignment on restricted fields", async () => {
    const alice = await createTestUser("Alice");
    const anon = createAnon();

    await expectDenied(
      anon.db.user.create({
        data: { name: "Evil", email: "evil@test.com", role: "ADMIN" },
      })
    );

    await expectDenied(
      alice.db.user.update({
        where: { publicId: alice.user.publicId },
        data: { publicId: "new-uuid" },
      })
    );
    await expectDenied(
      alice.db.user.update({
        where: { publicId: alice.user.publicId },
        data: { createdAt: new Date("2000-01-01") },
      })
    );

    await expectDenied(
      alice.db.apiKey.create({
        data: { name: "bad", prefix: "x", hashedKey: "x", userId: alice.user.id, revoked: true },
      })
    );
  });

  it("should ensure logical separation for Soft Deleted items (Revoked)", async () => {
    const alice = await createTestUser("Alice");
    const key = await alice.db.apiKey.create({
      data: { name: "k", prefix: "p", hashedKey: "h", userId: alice.user.id },
    });

    await alice.db.apiKey.delete({ where: { id: key.id } });

    const found = await alice.db.apiKey.findUnique({ where: { id: key.id } });
    expect(found).not.toBeNull();
    expect(found?.revoked).toBe(true);

    await alice.db.apiKey.update({
      where: { id: key.id },
      data: { name: "Renamed Revoked Key" },
    });

    const updated = await alice.db.apiKey.findUnique({ where: { id: key.id } });
    expect(updated?.name).toBe("Renamed Revoked Key");
  });
});
