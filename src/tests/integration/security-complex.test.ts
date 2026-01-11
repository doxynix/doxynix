import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/shared/api/db/db";

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
          name: "evil",
          url: "https://github.com/alice/evil",
          owner: "a",
          githubId: 1,
          userId: bob.user.id,
        },
      })
    );

    await expectDenied(
      alice.db.repo.create({
        data: {
          name: "evil-conn",
          url: "https://github.com/alice/evil-conn",
          owner: "a",
          githubId: 2,
          visibility: "PRIVATE",
          user: { connect: { publicId: bob.user.publicId } },
        },
      })
    );

    const aliceRepo = await alice.db.repo.create({
      data: {
        name: "ok",
        url: "https://github.com/alice/ok",
        owner: "a",
        githubId: 3,
        userId: alice.user.id,
      },
    });

    await expectDenied(
      bob.db.analysis.create({
        data: {
          repo: { connect: { publicId: aliceRepo.publicId } },
          status: "NEW",
          commitSha: "x",
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
        name: "target",
        url: "https://github.com/alice/target",
        owner: "a",
        githubId: 10,
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
        name: "my-precious",
        url: "https://github.com/alice/precious",
        owner: "a",
        githubId: 777,
        userId: alice.user.id,
      },
    });

    await expectDenied(
      alice.db.repo.update({
        where: { publicId: repo.publicId },
        data: { userId: bob.user.id },
      })
    );

    const refetched = await prisma.repo.findUnique({ where: { publicId: repo.publicId } });
    expect(refetched?.userId).toBe(alice.user.id);

    try {
      await admin.db.repo.update({
        where: { publicId: repo.publicId },
        data: { userId: bob.user.id },
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
