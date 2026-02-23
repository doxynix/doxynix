import { beforeEach, describe, expect, it } from "vitest";

import { cleanupDatabase, createTestUser, expectDenied } from "../helpers";

describe("Repositories & Data Visibility", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  it("should enforce Public/Private visibility rules", async () => {
    const alice = await createTestUser("Alice");
    const bob = await createTestUser("Bob");

    const privateRepo = await alice.db.repo.create({
      data: {
        githubId: 1,
        name: "priv",
        owner: "alice",
        url: "https://github.com/alice/priv",
        userId: alice.user.id,
        visibility: "PRIVATE",
      },
    });
    const publicRepo = await alice.db.repo.create({
      data: {
        githubId: 2,
        name: "pub",
        owner: "alice",
        url: "https://github.com/alice/pub",
        userId: alice.user.id,
        visibility: "PUBLIC",
      },
    });

    await expectDenied(
      bob.db.repo.findUniqueOrThrow({
        where: { publicId: privateRepo.publicId },
      })
    );
    await expectDenied(bob.db.repo.findUniqueOrThrow({ where: { publicId: publicRepo.publicId } }));

    await expect(
      alice.db.repo.findUniqueOrThrow({ where: { publicId: publicRepo.publicId } })
    ).resolves.toBeDefined();
  });

  it("should inherit permissions for child resources (Analysis/Docs)", async () => {
    const alice = await createTestUser("Alice");
    const bob = await createTestUser("Bob");

    const repo = await alice.db.repo.create({
      data: {
        githubId: 3,
        name: "n",
        owner: "a",
        url: "https://github.com/alice/n",
        userId: alice.user.id,
        visibility: "PRIVATE",
      },
    });
    const analysis = await alice.db.analysis.create({
      data: {
        commitSha: "s",
        repo: { connect: { publicId: repo.publicId } },
        score: 100,
        status: "DONE",
      },
    });

    await expectDenied(
      bob.db.analysis.findUniqueOrThrow({ where: { publicId: analysis.publicId } })
    );
    await expect(
      alice.db.analysis.findUniqueOrThrow({ where: { publicId: analysis.publicId } })
    ).resolves.toBeDefined();
  });

  it("should not leak data via Aggregates, GroupBy, or FindMany", async () => {
    const alice = await createTestUser("Alice");
    const bob = await createTestUser("Bob");

    await alice.db.repo.create({
      data: {
        githubId: 4,
        name: "sec",
        owner: "a",
        url: "https://github.com/alice/sec",
        userId: alice.user.id,
        visibility: "PRIVATE",
      },
    });

    const list = await bob.db.repo.findMany();
    expect(list).toHaveLength(0);

    const first = await bob.db.repo.findFirst();
    expect(first).toBeNull();

    const agg = await bob.db.repo.aggregate({ _count: true });
    expect(agg._count).toBe(0);

    const groups = await bob.db.repo.groupBy({ _count: true, by: ["visibility"] });
    expect(groups).toHaveLength(0);
  });

  it("should support Search via pg_trgm extensions", async () => {
    const alice = await createTestUser("Alice");
    const bob = await createTestUser("Bob");

    await alice.db.repo.create({
      data: {
        githubId: 5,
        name: "super-fast-engine",
        owner: "a",
        url: "https://github.com/alice/super-fast",
        userId: alice.user.id,
        visibility: "PUBLIC",
      },
    });

    const bobRes = await bob.db.repo.findMany({
      where: { name: { contains: "fast", mode: "insensitive" } },
    });
    expect(bobRes).toHaveLength(0);

    const aliceRes = await alice.db.repo.findMany({
      where: { name: { contains: "fast", mode: "insensitive" } },
    });
    expect(aliceRes).toHaveLength(1);
  });

  it("should handle huge payloads (limits check)", async () => {
    const alice = await createTestUser("Alice");
    const hugeContent = "X".repeat(100 * 1024);

    const repo = await alice.db.repo.create({
      data: {
        githubId: 6,
        name: "big",
        owner: "a",
        url: "https://github.com/alice/big",
        userId: alice.user.id,
      },
    });

    const doc = await alice.db.document.create({
      data: {
        content: hugeContent,
        repo: { connect: { publicId: repo.publicId } },
        type: "README",
        version: "v1",
      },
    });
    expect(doc.publicId).toBeDefined();
  });
  it("should handle Complex Filter + Sort combinations without leaking", async () => {
    const alice = await createTestUser("Alice");
    const bob = await createTestUser("Bob");

    await alice.db.repo.create({
      data: {
        githubId: 101,
        name: "react-ui",
        owner: "a",
        stars: 10,
        url: "https://github.com/alice/u",
        userId: alice.user.id,
        visibility: "PUBLIC",
      },
    });
    await alice.db.repo.create({
      data: {
        githubId: 102,
        name: "react-core",
        owner: "a",
        stars: 5,
        url: "https://github.com/alice/q",
        userId: alice.user.id,
        visibility: "PUBLIC",
      },
    });
    await alice.db.repo.create({
      data: {
        githubId: 103,
        name: "react-secret",
        owner: "a",
        stars: 50,
        url: "https://github.com/alice/m",
        userId: alice.user.id,
        visibility: "PRIVATE",
      },
    });

    const bobResults = await bob.db.repo.findMany({
      orderBy: { stars: "desc" },
      where: { name: { contains: "react", mode: "insensitive" } },
    });
    expect(bobResults).toHaveLength(0);

    const aliceResults = await alice.db.repo.findMany({
      orderBy: { stars: "desc" },
      where: {
        name: { contains: "react", mode: "insensitive" },
      },
    });

    expect(aliceResults).toHaveLength(3);
    expect(aliceResults[0].name).toBe("react-secret");
    expect(aliceResults[1].name).toBe("react-ui");
    expect(aliceResults[2].name).toBe("react-core");
  });
});
