import { enhance } from "@zenstackhq/runtime";
import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/shared/api/db/db";

import { cleanupDatabase, createTestUser, expectDenied, expectValidationFail } from "../helpers";

describe("Users, Admin & Audit Flows", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  it("should handle User Profile CRUD and validation", async () => {
    const alice = await createTestUser("Alice");
    const bob = await createTestUser("Bob");

    await expect(
      alice.db.user.update({
        where: { id: alice.user.id },
        data: { name: "Alice Wonderland" },
      })
    ).resolves.toMatchObject({ name: "Alice Wonderland" });

    await expectDenied(
      bob.db.user.update({ where: { id: alice.user.id }, data: { name: "HACKED" } })
    );
    await expectDenied(alice.db.user.delete({ where: { id: bob.user.id } }));

    await expectValidationFail(
      alice.db.user.update({ where: { id: alice.user.id }, data: { email: "bad-email" } })
    );
    await expectValidationFail(
      alice.db.user.update({ where: { id: alice.user.id }, data: { name: "" } })
    );
  });

  it("should enforce Role escalation protection & Admin powers", async () => {
    const admin = await createTestUser("Admin", "ADMIN");
    const alice = await createTestUser("Alice", "USER");
    const bob = await createTestUser("Bob", "USER");

    await expectDenied(
      alice.db.user.update({ where: { id: alice.user.id }, data: { role: "ADMIN" } })
    );

    await expect(
      admin.db.user.update({ where: { id: alice.user.id }, data: { role: "ADMIN" } })
    ).resolves.toBeDefined();

    const aliceAdminDb = enhance(prisma, { user: { id: alice.user.id, role: "ADMIN" } });
    await expect(
      aliceAdminDb.user.update({ where: { id: bob.user.id }, data: { role: "ADMIN" } })
    ).resolves.toBeDefined();
  });

  it("should secure Audit Logs (Tamper resistance)", async () => {
    const admin = await createTestUser("Admin", "ADMIN");
    const alice = await createTestUser("Alice", "USER");
    const bob = await createTestUser("Bob", "USER");

    const log = await alice.db.auditLog.create({
      data: { model: "User", operation: "login", payload: { ok: true }, userId: alice.user.id },
    });

    await expect(
      alice.db.auditLog.findUniqueOrThrow({ where: { id: log.id } })
    ).resolves.toBeDefined();

    await expectDenied(bob.db.auditLog.findUniqueOrThrow({ where: { id: log.id } }));

    await expectDenied(
      alice.db.auditLog.update({ where: { id: log.id }, data: { payload: { tampered: true } } })
    );
    await expectDenied(alice.db.auditLog.delete({ where: { id: log.id } }));

    await expect(
      admin.db.auditLog.findUniqueOrThrow({ where: { id: log.id } })
    ).resolves.toBeDefined();
  });

  it("should cascade delete user resources", async () => {
    const alice = await createTestUser("Alice");

    const repo = await alice.db.repo.create({
      data: {
        name: "cascade",
        url: "https://github.com/alice/cascade",
        owner: "a",
        githubId: 1,
        userId: alice.user.id,
      },
    });
    await alice.db.apiKey.create({
      data: { name: "k", prefix: "p", hashedKey: "h", userId: alice.user.id },
    });
    await alice.db.analysis.create({
      data: { repoId: repo.id, status: "NEW", commitSha: "x" },
    });

    await alice.db.user.delete({ where: { id: alice.user.id } });

    const counts = await Promise.all([
      prisma.repo.count(),
      prisma.apiKey.count(),
      prisma.analysis.count(),
    ]);
    expect(counts).toEqual([0, 0, 0]);
  });

  it("should handle Audit Log pagination and ordering", async () => {
    const alice = await createTestUser("Alice");
    const batch = Array.from({ length: 60 }, (_, i) => ({
      model: "Repo",
      operation: "update",
      payload: { i },
      userId: alice.user.id,
    }));

    await prisma.auditLog.createMany({ data: batch });

    const page1 = await alice.db.auditLog.findMany({ where: { userId: alice.user.id }, take: 50 });
    const page2 = await alice.db.auditLog.findMany({
      where: { userId: alice.user.id },
      skip: 50,
      take: 50,
    });

    expect(page1).toHaveLength(50);
    expect(page2).toHaveLength(10);
  });
});
