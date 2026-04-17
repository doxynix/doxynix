import { beforeEach, describe, expect, it } from "vitest";

import { cleanupDatabase, createTestUser, expectDenied, expectValidationFail } from "../helpers";

describe("Business Logic & Integrity Constraints", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  it("should enforce unique constraint on Documents (Repo + Version + Type + Analysis)", async () => {
    const alice = await createTestUser("Alice");

    const repo = await alice.db.repo.create({
      data: {
        githubId: 100,
        name: "docs-repo",
        owner: "alice",
        url: "https://github.com/alice/docs",
        userId: alice.user.id,
      },
    });

    const analysis1 = await alice.db.analysis.create({
      data: {
        repo: { connect: { publicId: repo.publicId } },
        status: "DONE",
      },
    });

    const analysis2 = await alice.db.analysis.create({
      data: {
        repo: { connect: { publicId: repo.publicId } },
        status: "DONE",
      },
    });

    // Same (repo, version, type) but different analysis - should succeed
    await alice.db.document.create({
      data: {
        analysis: { connect: { publicId: analysis1.publicId } },
        content: "Original Content",
        repo: { connect: { publicId: repo.publicId } },
        type: "README",
        version: "v1",
      },
    });

    await expect(
      alice.db.document.create({
        data: {
          analysis: { connect: { publicId: analysis2.publicId } },
          content: "Different Analysis Content",
          repo: { connect: { publicId: repo.publicId } },
          type: "README",
          version: "v1",
        },
      })
    ).resolves.toBeDefined();

    // Same (repo, version, type, analysis) - should fail
    await expectValidationFail(
      alice.db.document.create({
        data: {
          analysis: { connect: { publicId: analysis1.publicId } },
          content: "Duplicate Content",
          repo: { connect: { publicId: repo.publicId } },
          type: "README",
          version: "v1",
        },
      })
    );

    // Different version/type - should always succeed
    await expect(
      alice.db.document.create({
        data: {
          analysis: { connect: { publicId: analysis1.publicId } },
          content: "New Version",
          repo: { connect: { publicId: repo.publicId } },
          type: "README",
          version: "v2",
        },
      })
    ).resolves.toBeDefined();

    await expect(
      alice.db.document.create({
        data: {
          analysis: { connect: { publicId: analysis1.publicId } },
          content: "API Docs",
          repo: { connect: { publicId: repo.publicId } },
          type: "API",
          version: "v1",
        },
      })
    ).resolves.toBeDefined();
  });

  it("should allow users to manage their own Accounts but isolate others", async () => {
    const alice = await createTestUser("Alice");
    const bob = await createTestUser("Bob");

    const aliceAccount = await alice.db.account.create({
      data: {
        provider: "github",
        providerAccountId: "gh_alice_123",
        type: "oauth",
        userId: alice.user.id,
      },
    });

    const bobAccount = await bob.db.account.create({
      data: {
        provider: "google",
        providerAccountId: "go_bob_456",
        type: "oauth",
        userId: bob.user.id,
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
        provider: "github",
        providerAccountId: "12345",
        type: "oauth",
        userId: alice.user.id,
      },
    });

    await expectValidationFail(
      hacker.db.account.create({
        data: {
          provider: "github",
          providerAccountId: "12345",
          type: "oauth",
          userId: hacker.user.id,
        },
      })
    );
  });

  it("should ensure Session Token privacy (Anti-Hijacking)", async () => {
    const alice = await createTestUser("Alice");
    const bob = await createTestUser("Bob");

    const session = await alice.db.session.create({
      data: {
        expires: new Date(Date.now() + 10_000),
        sessionToken: "secret_token_123",
        userId: alice.user.id,
      },
    });

    await expectDenied(bob.db.session.findUniqueOrThrow({ where: { publicId: session.publicId } }));

    const stolenSession = await bob.db.session.findUnique({
      where: { sessionToken: "secret_token_123" },
    });
    expect(stolenSession).toBeNull();
  });
});
