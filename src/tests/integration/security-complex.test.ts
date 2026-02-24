import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/db";

import { cleanupDatabase, createTestUser, expectDenied } from "../helpers";

describe("Complex Attacks: Nested Writes & Bulk Operations", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  it("should prevent Nested Write Escalation (Connecting to others' resources)", async () => {
    const alice = await createTestUser("Alice");
    const bob = await createTestUser("Bob");

    await expectDenied(
      alice.db.repo.create({
        data: {
          githubId: 1,
          name: "evil",
          owner: "a",
          url: "https://github.com/alice/evil",
          userId: bob.user.id,
        },
      })
    );

    await expectDenied(
      alice.db.repo.create({
        data: {
          githubId: 2,
          name: "evil-conn",
          owner: "a",
          url: "https://github.com/alice/evil-conn",
          user: { connect: { publicId: bob.user.publicId } },
          visibility: "PRIVATE",
        },
      })
    );

    const aliceRepo = await alice.db.repo.create({
      data: {
        githubId: 3,
        name: "ok",
        owner: "a",
        url: "https://github.com/alice/ok",
        userId: alice.user.id,
      },
    });

    await expectDenied(
      bob.db.analysis.create({
        data: {
          commitSha: "x",
          repo: { connect: { publicId: aliceRepo.publicId } },
          status: "NEW",
        },
      })
    );
  });

  it("should protect Bulk Operations (UpdateMany, DeleteMany)", async () => {
    const alice = await createTestUser("Alice");
    const bob = await createTestUser("Bob");
    const admin = await createTestUser("Admin", "ADMIN");

    await alice.db.repo.create({
      data: {
        githubId: 10,
        name: "target",
        owner: "a",
        url: "https://github.com/alice/target",
        userId: alice.user.id,
      },
    });

    await expectDenied(bob.db.repo.updateMany({ data: { visibility: "PUBLIC" } }));

    const delResult = await bob.db.repo.deleteMany({});
    expect(delResult.count).toBe(0);

    const checkAlice = await prisma.repo.count({ where: { userId: alice.user.id } });
    expect(checkAlice).toBe(1);

    const adminResult = await admin.db.repo.deleteMany({});
    expect(adminResult.count).toBeGreaterThanOrEqual(1);
  });

  it("should prevent Ownership Transfer via Update", async () => {
    const alice = await createTestUser("Alice");
    const bob = await createTestUser("Bob");
    const admin = await createTestUser("Admin", "ADMIN");

    const repo = await alice.db.repo.create({
      data: {
        githubId: 777,
        name: "my-precious",
        owner: "a",
        url: "https://github.com/alice/precious",
        userId: alice.user.id,
      },
    });

    await expectDenied(
      alice.db.repo.update({
        data: { userId: bob.user.id },
        where: { publicId: repo.publicId },
      })
    );

    const refetched = await prisma.repo.findUnique({ where: { publicId: repo.publicId } });
    expect(refetched?.userId).toBe(alice.user.id);

    try {
      await admin.db.repo.update({
        data: { userId: bob.user.id },
        where: { publicId: repo.publicId },
      });
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes("result is not allowed to be read back")) {
        return;
      }

      throw e;
    }

    const final = await prisma.repo.findUnique({ where: { publicId: repo.publicId } });
    expect(final?.userId).toBe(bob.user.id);
  });
});
