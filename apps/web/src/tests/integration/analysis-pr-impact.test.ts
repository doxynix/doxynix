import { beforeEach, describe, expect, it } from "vitest";

import { prImpactService } from "../../server/modules/analysis/services/pr-impact.service";
import { cleanupDatabase, createTestUser, expectDenied } from "../helpers";

/**
 * DXNX-238, step 2. Real Postgres, no mocks: `prImpactService` talks to the
 * database and to nothing else, so every assertion here runs against real rows
 * and the real ZenStack policies.
 *
 * Scope limit: the full impact-mapping path of `getByRepoAndPRNumber` is NOT
 * covered here. It reaches `analysisMapper.buildTopFindings`, which renders each
 * finding through Next's `unstable_cache` (analysis.mapper.ts). That throws
 * `Invariant: incrementalCache missing` outside a Next request scope, so the
 * happy path can only be exercised from a route handler or with a request scope
 * stubbed. The early returns below are all reachable without it.
 */

type FixtureOwner = {
  db: Awaited<ReturnType<typeof createTestUser>>["db"];
  name: string;
  user: { id: number };
};

async function createRepoFixture(name: string) {
  const owner = await createTestUser(name);
  const repo = await owner.db.repo.create({
    data: {
      defaultBranch: "main",
      githubId: Math.floor(Math.random() * 1_000_000_000),
      name: `repo-${name.toLowerCase()}`,
      owner: name.toLowerCase(),
      url: `https://github.com/${name.toLowerCase()}/repo`,
      userId: owner.user.id,
      visibility: "PUBLIC",
    },
  });

  return {
    db: owner.db,
    fixture: { owner: name.toLowerCase(), repoId: repo.publicId, repoName: repo.name },
    owner: { db: owner.db, name, user: owner.user },
  };
}

type TestDb = Awaited<ReturnType<typeof createTestUser>>["db"];

async function createSecondRepo(owner: FixtureOwner, suffix: string) {
  const repo = await owner.db.repo.create({
    data: {
      defaultBranch: "main",
      githubId: Math.floor(Math.random() * 1_000_000_000),
      name: `repo-${suffix}`,
      owner: owner.name.toLowerCase(),
      url: `https://github.com/${owner.name.toLowerCase()}/${suffix}`,
      userId: owner.user.id,
      visibility: "PUBLIC",
    },
  });

  return {
    fixture: {
      owner: owner.name.toLowerCase(),
      repoId: repo.publicId,
      repoName: repo.name,
    },
  };
}

function createPullRequestAnalysis(
  db: TestDb,
  fixture: { owner: string; repoId: string; repoName: string },
  overrides: { prNumber?: number; riskScore?: number; status?: string } = {},
) {
  return db.pullRequestAnalysis.create({
    data: {
      baseSha: "base-sha-1",
      changedFilesJson: [
        { additions: 3, deletions: 1, filePath: "src/index.ts", status: "modified" },
      ],
      findingsJson: [
        {
          file: "src/index.ts",
          line: 2,
          message: "Consider extracting a helper.",
          score: 5,
          severity: "MEDIUM",
          suggestion: "Extract it.",
          title: "Long function",
          type: "COMPLEXITY",
        },
      ],
      headSha: "head-sha-1",
      owner: fixture.owner,
      prNumber: overrides.prNumber ?? 42,
      repo: { connect: { publicId: fixture.repoId } },
      repoName: fixture.repoName,
      riskScore: overrides.riskScore ?? 5,
      status: (overrides.status ?? "COMPLETED") as never,
    },
  });
}

describe("prImpactService.getAnalysis", () => {
  beforeEach(cleanupDatabase);

  it("returns the stored analysis by its public id", async () => {
    const { db, fixture } = await createRepoFixture("OwnerGet");
    const created = await createPullRequestAnalysis(db, fixture, { riskScore: 7 });

    const found = await prImpactService.getAnalysis(db, created.publicId);

    expect(found.publicId).toBe(created.publicId);
    expect(found.prNumber).toBe(42);
    expect(found.riskScore).toBe(7);
    expect(found.baseSha).toBe("base-sha-1");
    expect(found.headSha).toBe("head-sha-1");
  });

  it("throws for an unknown analysis id", async () => {
    const { db } = await createRepoFixture("OwnerMissing");

    await expect(
      prImpactService.getAnalysis(db, "00000000-0000-0000-0000-000000000000"),
    ).rejects.toThrow("Analysis not found");
  });
});

describe("prImpactService.listByRepository", () => {
  beforeEach(cleanupDatabase);

  it("returns an empty list for a repository without analyses", async () => {
    const { db, fixture } = await createRepoFixture("OwnerEmpty");

    await expect(prImpactService.listByRepository(db, fixture.repoId)).resolves.toEqual([]);
  });

  it("maps analyses and counts their comments", async () => {
    const { db, fixture } = await createRepoFixture("OwnerList");
    const analysis = await createPullRequestAnalysis(db, fixture);

    await db.pullRequestComment.create({
      data: {
        analysis: { connect: { publicId: analysis.publicId } },
        body: "first",
        filePath: "src/index.ts",
        findingType: "COMPLEXITY",
        line: 2,
        riskLevel: 5,
      },
    });
    await db.pullRequestComment.create({
      data: {
        analysis: { connect: { publicId: analysis.publicId } },
        body: "second",
        filePath: "src/other.ts",
        findingType: "BUG",
        line: 9,
        riskLevel: 8,
      },
    });

    const [listed] = await prImpactService.listByRepository(db, fixture.repoId);

    expect(listed).toMatchObject({
      findingCount: 2,
      headSha: "head-sha-1",
      id: analysis.publicId,
      prNumber: 42,
      riskScore: 5,
      status: "COMPLETED",
    });
  });

  it("lists every analysis of the repository", async () => {
    const { db, fixture } = await createRepoFixture("OwnerOrder");

    await createPullRequestAnalysis(db, fixture, { prNumber: 1 });
    await createPullRequestAnalysis(db, fixture, { prNumber: 2 });

    const listed = await prImpactService.listByRepository(db, fixture.repoId);

    expect(listed.map((item) => item.prNumber).sort((a, b) => a - b)).toEqual([1, 2]);
    expect(new Set(listed.map((item) => item.id)).size).toBe(2);
  });

  it("does not leak analyses from another repository", async () => {
    const { db, fixture: mine, owner } = await createRepoFixture("OwnerScope");
    // Same owner, so the policy allows writing to both; only the query scoping
    // decides which analyses come back.
    const { fixture: other } = await createSecondRepo(owner, "other");

    await createPullRequestAnalysis(db, mine, { prNumber: 7 });
    await createPullRequestAnalysis(db, other, { prNumber: 8 });

    const listed = await prImpactService.listByRepository(db, mine.repoId);

    expect(listed).toHaveLength(1);
    expect(listed[0]?.prNumber).toBe(7);
  });

  it("denies a user who does not own the repository", async () => {
    // The ZenStack policy is `repo.user == auth() || role == 'ADMIN'`, so a
    // different user must not even be able to create the analysis.
    const { fixture } = await createRepoFixture("OwnerPolicy");
    const stranger = await createTestUser("Stranger");

    await expectDenied(
      stranger.db.pullRequestAnalysis.create({
        data: {
          baseSha: "base-sha-1",
          headSha: "head-sha-1",
          owner: fixture.owner,
          prNumber: 99,
          repo: { connect: { publicId: fixture.repoId } },
          repoName: fixture.repoName,
        },
      }),
    );
  });
});

describe("prImpactService.getByRepoAndPRNumber", () => {
  beforeEach(cleanupDatabase);

  it("returns null when the repository has no analysis for that PR", async () => {
    const { db, fixture } = await createRepoFixture("OwnerNoPr");

    await expect(prImpactService.getByRepoAndPRNumber(db, fixture.repoId, 999)).resolves.toBeNull();
  });

  it("returns null for an unknown repository", async () => {
    const { db } = await createRepoFixture("OwnerNoRepo");

    await expect(
      prImpactService.getByRepoAndPRNumber(db, "00000000-0000-0000-0000-000000000000", 1),
    ).resolves.toBeNull();
  });

  it("returns null for a PR number that was never analyzed", async () => {
    const { db, fixture } = await createRepoFixture("OwnerPicked");
    await createPullRequestAnalysis(db, fixture, { prNumber: 3 });

    // No matching PR analysis -> a clean null, before the snapshot lookup.
    await expect(prImpactService.getByRepoAndPRNumber(db, fixture.repoId, 4)).resolves.toBeNull();
  });
});
