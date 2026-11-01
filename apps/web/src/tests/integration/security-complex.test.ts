import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/core/db";

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
          createdByUserId: bob.user.id,
          githubId: 1,
          name: "evil",
          owner: "a",
          url: "https://github.com/alice/evil",
          workspaceId: bob.workspace.id,
        },
      }),
    );

    await expectDenied(
      alice.db.repo.create({
        data: {
          createdByUserId: bob.user.id,
          githubId: 2,
          name: "evil-conn",
          owner: "a",
          url: "https://github.com/alice/evil-conn",
          visibility: "PRIVATE",
          workspaceId: bob.workspace.id,
        },
      }),
    );

    const aliceRepo = await alice.db.repo.create({
      data: {
        createdByUserId: alice.user.id,
        githubId: 3,
        name: "ok",
        owner: "a",
        url: "https://github.com/alice/ok",
        workspaceId: alice.workspace.id,
      },
    });

    await expectDenied(
      bob.db.analysis.create({
        data: {
          commitSha: "x",
          repo: { connect: { id: aliceRepo.id } },
          status: "NEW",
        },
      }),
    );
  });

  it("should protect Bulk Operations (UpdateMany, DeleteMany)", async () => {
    const alice = await createTestUser("Alice");
    const bob = await createTestUser("Bob");
    const admin = await createTestUser("Admin", "ADMIN");

    await alice.db.repo.create({
      data: {
        createdByUserId: alice.user.id,
        githubId: 10,
        name: "target",
        owner: "a",
        url: "https://github.com/alice/target",
        workspaceId: alice.workspace.id,
      },
    });

    await expectDenied(bob.db.repo.updateMany({ data: { visibility: "PUBLIC" } }));

    const delResult = await bob.db.repo.deleteMany({});
    expect(delResult.count).toBe(0);

    const checkAlice = await prisma.repo.count({ where: { workspaceId: alice.workspace.id } });
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
        createdByUserId: alice.user.id,
        githubId: 777,
        name: "my-precious",
        owner: "a",
        url: "https://github.com/alice/precious",
        workspaceId: alice.workspace.id,
      },
    });

    await expectDenied(
      alice.db.repo.update({
        data: { workspaceId: bob.workspace.id },
        where: { id: repo.id },
      }),
    );

    const refetched = await prisma.repo.findUnique({ where: { id: repo.id } });
    expect(refetched?.workspaceId).toBe(alice.workspace.id);

    try {
      await admin.db.repo.update({
        data: { workspaceId: bob.workspace.id },
        where: { id: repo.id },
      });
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message.includes("result is not allowed to be read back")
      ) {
        return;
      }

      throw error;
    }

    const final = await prisma.repo.findUnique({ where: { id: repo.id } });
    expect(final?.workspaceId).toBe(bob.workspace.id);
  });
});
