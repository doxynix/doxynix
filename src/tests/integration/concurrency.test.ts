import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/shared/api/db/db";

import { cleanupDatabase, createTestUser, expectValidationFail } from "../helpers";

describe("Concurrency, Transactions & Integrity", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  it("should handle Race Conditions on Unique Constraints", async () => {
    const alice = await createTestUser("Alice");
    const base = {
      url: "https://github.com/alice/race",
      owner: "a",
      githubId: 999,
      userId: alice.user.id,
      visibility: "PRIVATE" as const,
    };

    const p1 = alice.db.repo.create({ data: { ...base, name: "race1" } });
    const p2 = alice.db.repo.create({ data: { ...base, name: "race2" } });

    const results = await Promise.allSettled([p1, p2]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  });

  it("should handle Atomic Updates (increments)", async () => {
    const alice = await createTestUser("Alice");
    const repo = await alice.db.repo.create({
      data: {
        name: "inc",
        url: "https://github.com/alice/inc",
        owner: "a",
        githubId: 1,
        userId: alice.user.id,
        stars: 0,
      },
    });

    await Promise.all([
      prisma.repo.update({ where: { publicId: repo.publicId }, data: { stars: { increment: 1 } } }),
      prisma.repo.update({ where: { publicId: repo.publicId }, data: { stars: { increment: 1 } } }),
    ]);

    const final = await prisma.repo.findUnique({ where: { publicId: repo.publicId } });
    expect(final?.stars).toBe(2);
  });

  it("should rollback transactions on error", async () => {
    const alice = await createTestUser("Alice");
    const repoName = "rollback-test";

    try {
      await prisma.$transaction(async (tx) => {
        await tx.repo.create({
          data: {
            name: repoName,
            url: "https://github.com/alice/rollback",
            owner: "a",
            githubId: 500,
            userId: alice.user.id,
          },
        });
        throw new Error("Boom");
      });
    } catch {
      /* ignore */
    }

    const found = await prisma.repo.findFirst({ where: { name: repoName } });
    expect(found).toBeNull();
  });

  it("should validate boundaries and injection strings", async () => {
    const alice = await createTestUser("Alice");
    const repo = await alice.db.repo.create({
      data: {
        name: "b",
        url: "https://github.com/alice/b",
        owner: "a",
        githubId: 2,
        userId: alice.user.id,
      },
    });

    await expectValidationFail(
      alice.db.analysis.create({
        data: {
          repo: { connect: { publicId: repo.publicId } },
          status: "DONE",
          commitSha: "x",
          score: 101,
        },
      })
    );

    const maliciousJson = { v: "'; DROP TABLE users; --" };
    const analysis = await alice.db.analysis.create({
      data: {
        repo: { connect: { publicId: repo.publicId } },
        status: "DONE",
        commitSha: "x",
        metricsJson: maliciousJson,
      },
    });

    const fetched = await alice.db.analysis.findUnique({ where: { publicId: analysis.publicId } });
    expect(fetched?.metricsJson).toEqual(maliciousJson);
  });
});
