import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/db";

import { cleanupDatabase, createTestUser, expectValidationFail } from "../helpers";

describe("Concurrency, Transactions & Integrity", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  it("should handle Race Conditions on Unique Constraints", async () => {
    const alice = await createTestUser("Alice");
    const base = {
      githubId: 999,
      owner: "a",
      url: "https://github.com/alice/race",
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
        githubId: 1,
        name: "inc",
        owner: "a",
        stars: 0,
        url: "https://github.com/alice/inc",
        userId: alice.user.id,
      },
    });

    await Promise.all([
      prisma.repo.update({ data: { stars: { increment: 1 } }, where: { publicId: repo.publicId } }),
      prisma.repo.update({ data: { stars: { increment: 1 } }, where: { publicId: repo.publicId } }),
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
            githubId: 500,
            name: repoName,
            owner: "a",
            url: "https://github.com/alice/rollback",
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
        githubId: 2,
        name: "b",
        owner: "a",
        url: "https://github.com/alice/b",
        userId: alice.user.id,
      },
    });

    await expectValidationFail(
      alice.db.analysis.create({
        data: {
          commitSha: "x",
          repo: { connect: { publicId: repo.publicId } },
          score: 101,
          status: "DONE",
        },
      })
    );

    const maliciousJson = { v: "'; DROP TABLE users; --" };
    const analysis = await alice.db.analysis.create({
      data: {
        commitSha: "x",
        metricsJson: maliciousJson,
        repo: { connect: { publicId: repo.publicId } },
        status: "DONE",
      },
    });

    const fetched = await alice.db.analysis.findUnique({ where: { publicId: analysis.publicId } });
    expect(fetched?.metricsJson).toEqual(maliciousJson);
  });
});
