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
        name: "priv",
        url: "https://github.com/alice/priv",
        owner: "alice",
        githubId: 1,
        visibility: "PRIVATE",
        userId: alice.user.id,
      },
    });
    const publicRepo = await alice.db.repo.create({
      data: {
        name: "pub",
        url: "https://github.com/alice/pub",
        owner: "alice",
        githubId: 2,
        visibility: "PUBLIC",
        userId: alice.user.id,
      },
    });

    await expectDenied(bob.db.repo.findUniqueOrThrow({ where: { id: privateRepo.id } }));

    await expectDenied(bob.db.repo.findUniqueOrThrow({ where: { id: publicRepo.id } }));

    await expect(
      alice.db.repo.findUniqueOrThrow({ where: { id: publicRepo.id } })
    ).resolves.toBeDefined();
  });

  it("should inherit permissions for child resources (Analysis/Docs)", async () => {
    const alice = await createTestUser("Alice");
    const bob = await createTestUser("Bob");

    const repo = await alice.db.repo.create({
      data: {
        name: "n",
        url: "https://github.com/alice/n",
        owner: "a",
        githubId: 3,
        visibility: "PRIVATE",
        userId: alice.user.id,
      },
    });
    const analysis = await alice.db.analysis.create({
      data: { repoId: repo.id, status: "DONE", commitSha: "s", score: 100 },
    });

    await expectDenied(bob.db.analysis.findUniqueOrThrow({ where: { id: analysis.id } }));
    await expect(
      alice.db.analysis.findUniqueOrThrow({ where: { id: analysis.id } })
    ).resolves.toBeDefined();
  });

  it("should not leak data via Aggregates, GroupBy, or FindMany", async () => {
    const alice = await createTestUser("Alice");
    const bob = await createTestUser("Bob");

    await alice.db.repo.create({
      data: {
        name: "sec",
        url: "https://github.com/alice/sec",
        owner: "a",
        githubId: 4,
        visibility: "PRIVATE",
        userId: alice.user.id,
      },
    });

    const list = await bob.db.repo.findMany();
    expect(list).toHaveLength(0);

    const first = await bob.db.repo.findFirst();
    expect(first).toBeNull();

    const agg = await bob.db.repo.aggregate({ _count: true });
    expect(agg._count).toBe(0);

    const groups = await bob.db.repo.groupBy({ by: ["visibility"], _count: true });
    expect(groups).toHaveLength(0);
  });

  it("should support Search via pg_trgm extensions", async () => {
    const alice = await createTestUser("Alice");
    const bob = await createTestUser("Bob");

    await alice.db.repo.create({
      data: {
        name: "super-fast-engine",
        url: "https://github.com/alice/super-fast",
        owner: "a",
        githubId: 5,
        visibility: "PUBLIC",
        userId: alice.user.id,
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

    const doc = await alice.db.document.create({
      data: {
        repoId: (
          await alice.db.repo.create({
            data: {
              name: "big",
              url: "https://github.com/alice/big",
              owner: "a",
              githubId: 6,
              userId: alice.user.id,
            },
          })
        ).id,
        version: "v1",
        type: "README",
        content: hugeContent,
      },
    });
    expect(doc.id).toBeDefined();
  });
  it("should handle Complex Filter + Sort combinations without leaking", async () => {
    const alice = await createTestUser("Alice");
    const bob = await createTestUser("Bob");

    await alice.db.repo.create({
      data: {
        name: "react-ui",
        url: "https://github.com/alice/u",
        owner: "a",
        githubId: 101,
        visibility: "PUBLIC",
        userId: alice.user.id,
        stars: 10,
      },
    });
    await alice.db.repo.create({
      data: {
        name: "react-core",
        url: "https://github.com/alice/q",
        owner: "a",
        githubId: 102,
        visibility: "PUBLIC",
        userId: alice.user.id,
        stars: 5,
      },
    });
    await alice.db.repo.create({
      data: {
        name: "react-secret",
        url: "https://github.com/alice/m",
        owner: "a",
        githubId: 103,
        visibility: "PRIVATE",
        userId: alice.user.id,
        stars: 50,
      },
    });

    const bobResults = await bob.db.repo.findMany({
      where: { name: { contains: "react", mode: "insensitive" } },
      orderBy: { stars: "desc" },
    });
    expect(bobResults).toHaveLength(0);

    const aliceResults = await alice.db.repo.findMany({
      where: {
        name: { contains: "react", mode: "insensitive" },
      },
      orderBy: { stars: "desc" },
    });

    expect(aliceResults).toHaveLength(3);
    expect(aliceResults[0].name).toBe("react-secret");
    expect(aliceResults[1].name).toBe("react-ui");
    expect(aliceResults[2].name).toBe("react-core");
  });
});
