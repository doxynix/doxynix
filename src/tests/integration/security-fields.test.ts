import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/db";

import { cleanupDatabase, createAnon, createTestUser, expectDenied } from "../helpers";

describe("Field-Level Security (Omit, Immutable, Mass Assignment)", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  it("should hide @omit fields (tokens, secrets) from ZenStack", async () => {
    const alice = await createTestUser("Alice");

    const key = await alice.db.apiKey.create({
      data: { hashedKey: "SECRET_HASH", name: "k", prefix: "p", userId: alice.user.id },
    });
    const fetchedKey = await alice.db.apiKey.findUnique({ where: { id: key.id } });
    expect(fetchedKey).not.toHaveProperty("hashedKey");

    await prisma.session.create({
      data: { expires: new Date(), sessionToken: "SESS_SECRET", userId: alice.user.id },
    });
    const fetchedSession = await alice.db.session.findUnique({
      where: { sessionToken: "SESS_SECRET" },
    });
    expect(fetchedSession).not.toHaveProperty("sessionToken");

    await prisma.account.create({
      data: {
        access_token: "ACC_TOK",
        provider: "gh",
        providerAccountId: "1",
        type: "oauth",
        userId: alice.user.id,
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
        data: { email: "evil@test.com", name: "Evil", role: "ADMIN" },
      })
    );

    await expectDenied(
      alice.db.user.update({
        data: { publicId: "new-uuid" },
        where: { publicId: alice.user.publicId },
      })
    );
    await expectDenied(
      alice.db.user.update({
        data: { createdAt: new Date("2000-01-01") },
        where: { publicId: alice.user.publicId },
      })
    );

    await expectDenied(
      alice.db.apiKey.create({
        data: { hashedKey: "x", name: "bad", prefix: "x", revoked: true, userId: alice.user.id },
      })
    );
  });

  it("should ensure logical separation for Soft Deleted items (Revoked)", async () => {
    const alice = await createTestUser("Alice");
    const key = await alice.db.apiKey.create({
      data: { hashedKey: "h", name: "k", prefix: "p", userId: alice.user.id },
    });

    await alice.db.apiKey.delete({ where: { id: key.id } });

    const found = await alice.db.apiKey.findUnique({ where: { id: key.id } });
    expect(found).not.toBeNull();
    expect(found?.revoked).toBe(true);

    await alice.db.apiKey.update({
      data: { name: "Renamed Revoked Key" },
      where: { id: key.id },
    });

    const updated = await alice.db.apiKey.findUnique({ where: { id: key.id } });
    expect(updated?.name).toBe("Renamed Revoked Key");
  });
});
