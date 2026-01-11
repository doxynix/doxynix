import { beforeEach, describe, expect, it } from "vitest";

import { cleanupDatabase, createTestUser, expectDenied, expectValidationFail } from "../helpers";

describe("Business Logic & Integrity Constraints", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  it("should enforce unique constraint on Documents (Repo + Version + Type)", async () => {
    const alice = await createTestUser("Alice");

    const repo = await alice.db.repo.create({
      data: {
        name: "docs-repo",
        url: "https://github.com/alice/docs",
        owner: "alice",
        githubId: 100,
        userId: alice.user.id,
      },
    });

    await alice.db.document.create({
      data: {
        repo: { connect: { publicId: repo.publicId } },
        version: "v1",
        type: "README",
        content: "Original Content",
      },
    });

    await expectValidationFail(
      alice.db.document.create({
        data: {
          repo: { connect: { publicId: repo.publicId } },
          version: "v1",
          type: "README",
          content: "Duplicate Content",
        },
      })
    );

    await expect(
      alice.db.document.create({
        data: {
          repo: { connect: { publicId: repo.publicId } },
          version: "v2",
          type: "README",
          content: "New Version",
        },
      })
    ).resolves.toBeDefined();
    await expect(
      alice.db.document.create({
        data: {
          repo: { connect: { publicId: repo.publicId } },
          version: "v1",
          type: "API",
          content: "API Docs",
        },
      })
    ).resolves.toBeDefined();
  });

  it("should allow users to manage their own Accounts but isolate others", async () => {
    const alice = await createTestUser("Alice");
    const bob = await createTestUser("Bob");

    const aliceAccount = await alice.db.account.create({
      data: {
        userId: alice.user.id,
        type: "oauth",
        provider: "github",
        providerAccountId: "gh_alice_123",
      },
    });

    const bobAccount = await bob.db.account.create({
      data: {
        userId: bob.user.id,
        type: "oauth",
        provider: "google",
        providerAccountId: "go_bob_456",
      },
    });

    await expectDenied(alice.db.account.delete({ where: { publicId: bobAccount.publicId } }));

    await expect(
      alice.db.account.delete({ where: { publicId: aliceAccount.publicId } })
    ).resolves.toBeDefined();

    const checkBob = await bob.db.account.findUnique({ where: { publicId: bobAccount.publicId } });
    expect(checkBob).toBeDefined();
  });

  it("should enforce unique Provider Account ID globally", async () => {
    const alice = await createTestUser("Alice");
    const hacker = await createTestUser("Hacker");

    await alice.db.account.create({
      data: {
        userId: alice.user.id,
        type: "oauth",
        provider: "github",
        providerAccountId: "12345",
      },
    });

    await expectValidationFail(
      hacker.db.account.create({
        data: {
          userId: hacker.user.id,
          type: "oauth",
          provider: "github",
          providerAccountId: "12345",
        },
      })
    );
  });

  it("should ensure Session Token privacy (Anti-Hijacking)", async () => {
    const alice = await createTestUser("Alice");
    const bob = await createTestUser("Bob");

    const session = await alice.db.session.create({
      data: {
        userId: alice.user.id,
        sessionToken: "secret_token_123",
        expires: new Date(Date.now() + 10000),
      },
    });

    await expectDenied(bob.db.session.findUniqueOrThrow({ where: { publicId: session.publicId } }));

    const stolenSession = await bob.db.session.findUnique({
      where: { sessionToken: "secret_token_123" },
    });
    expect(stolenSession).toBeNull();
  });
});
