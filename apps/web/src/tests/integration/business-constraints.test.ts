import { beforeEach, describe, expect, it } from "vitest";

import { getRawHash } from "@/server/utils/hash";

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
        repo: { connect: { id: repo.id } },
        status: "DONE",
      },
    });

    const analysis2 = await alice.db.analysis.create({
      data: {
        repo: { connect: { id: repo.id } },
        status: "DONE",
      },
    });

    await alice.db.document.create({
      data: {
        analysis: { connect: { id: analysis1.id } },
        content: "Original Content",
        path: "readme-1",
        repo: { connect: { id: repo.id } },
        type: "README",
        version: "v1",
      },
    });

    await expect(
      alice.db.document.create({
        data: {
          analysis: { connect: { id: analysis2.id } },
          content: "Different Analysis Content",
          path: "readme-2",
          repo: { connect: { id: repo.id } },
          type: "README",
          version: "v1",
        },
      }),
    ).resolves.toBeDefined();

    await expectValidationFail(
      alice.db.document.create({
        data: {
          analysis: { connect: { id: analysis1.id } },
          content: "Duplicate Content",
          path: "readme-1",
          repo: { connect: { id: repo.id } },
          type: "README",
          version: "v1",
        },
      }),
    );

    await expect(
      alice.db.document.create({
        data: {
          analysis: { connect: { id: analysis1.id } },
          content: "New Version",
          repo: { connect: { id: repo.id } },
          type: "README",
          version: "v2",
        },
      }),
    ).resolves.toBeDefined();

    await expect(
      alice.db.document.create({
        data: {
          analysis: { connect: { id: analysis1.id } },
          content: "API Docs",
          repo: { connect: { id: repo.id } },
          type: "API",
          version: "v1",
        },
      }),
    ).resolves.toBeDefined();
  });

  it("should allow users to manage their own Accounts but isolate others", async () => {
    const alice = await createTestUser("Alice");
    const bob = await createTestUser("Bob");

    const aliceAccount = await alice.db.account.create({
      data: {
        accountId: "gh_alice_123",
        providerId: "github",
        userId: alice.user.id,
      },
    });

    const bobAccount = await bob.db.account.create({
      data: {
        accountId: "go_bob_456",
        providerId: "google",
        userId: bob.user.id,
      },
    });

    await expectDenied(alice.db.account.delete({ where: { id: bobAccount.id } }));

    await expect(
      alice.db.account.delete({ where: { id: aliceAccount.id } }),
    ).resolves.toBeDefined();

    const checkBob = await bob.db.account.findUnique({ where: { id: bobAccount.id } });
    expect(checkBob).toBeDefined();
  });

  it("should enforce unique Provider Account ID globally", async () => {
    const alice = await createTestUser("Alice");
    const hacker = await createTestUser("Hacker");

    await alice.db.account.create({
      data: {
        accountId: "12345",
        providerId: "github",
        userId: alice.user.id,
      },
    });

    await expectValidationFail(
      hacker.db.account.create({
        data: {
          accountId: "12345",
          providerId: "github",
          userId: hacker.user.id,
        },
      }),
    );
  });

  it("should ensure Session Token privacy (Anti-Hijacking)", async () => {
    const alice = await createTestUser("Alice");
    const bob = await createTestUser("Bob");

    const session = await alice.db.session.create({
      data: {
        expiresAt: new Date(Date.now() + 10_000),
        token: "secret_token_123",
        userId: alice.user.id,
      },
    });

    await expectDenied(bob.db.session.findUniqueOrThrow({ where: { id: session.id } }));

    const stolenSession = await bob.db.session.findUnique({
      where: { tokenHash: getRawHash("secret_token_123") },
    });
    expect(stolenSession).toBeNull();
  });
});
