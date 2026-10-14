import { beforeEach, describe, expect, it } from "vitest";

import { adminReviewService } from "../../server/modules/analysis/admin-review.service";
import { cleanupDatabase, createTestUser } from "../helpers";

type TestDb = Awaited<ReturnType<typeof createTestUser>>["db"];

async function createRepo(name: string) {
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

  return { db: owner.db, fixture: { repoId: repo.id, repoName: repo.name } };
}

function createReview(
  db: TestDb,
  fixture: { repoId: string; repoName: string },
  overrides: { owner?: string; prNumber?: number; riskScore?: number; status?: string } = {},
) {
  return db.pullRequestAnalysis.create({
    data: {
      baseSha: "base-sha-1",
      headSha: "head-sha-1",
      owner: overrides.owner ?? "someone",
      prNumber: overrides.prNumber ?? 42,
      repo: { connect: { id: fixture.repoId } },
      repoName: fixture.repoName,
      riskScore: overrides.riskScore ?? 5,
      status: (overrides.status ?? "COMPLETED") as never,
    },
  });
}

describe("adminReviewService against ZenStack policies", () => {
  beforeEach(cleanupDatabase);

  it("lists reviews across every owner, which a repo owner cannot do", async () => {
    const admin = await createTestUser("Admin", "ADMIN");
    const first = await createRepo("OwnerA");
    const second = await createRepo("OwnerB");

    await createReview(first.db, first.fixture, { owner: "ownera", prNumber: 1 });
    await createReview(second.db, second.fixture, { owner: "ownerb", prNumber: 2 });

    const asAdmin = await adminReviewService.getAll(admin.db, { limit: 50 });
    expect(asAdmin.items).toHaveLength(2);

    // The repo owner's own client sees exactly their own row, so the admin view is genuinely broader.
    const asOwner = await adminReviewService.getAll(first.db, { limit: 50 });
    expect(asOwner.items.map((item) => item.prNumber)).toEqual([1]);
  });

  it("counts the fixes attached to a review without loading them", async () => {
    const admin = await createTestUser("Admin", "ADMIN");
    const fixture = await createRepo("OwnerFixes");
    const review = await createReview(fixture.db, fixture.fixture);

    await fixture.db.generatedFix.create({
      data: {
        branch: "fix/one",
        prAnalysisId: review.id,
        repoId: fixture.fixture.repoId,
        title: "One",
      },
    });
    await fixture.db.generatedFix.create({
      data: {
        branch: "fix/two",
        prAnalysisId: review.id,
        repoId: fixture.fixture.repoId,
        title: "Two",
      },
    });

    const list = await adminReviewService.getAll(admin.db, { limit: 50 });
    expect(list.items[0]).toMatchObject({ fixCount: 2, id: review.id });

    const detail = await adminReviewService.getDetail(admin.db, review.id);
    expect(detail.fixes).toHaveLength(2);
    expect(detail.fixes.map((fix) => fix.title).sort()).toEqual(["One", "Two"]);
  });

  it("filters by status, risk score and fix status", async () => {
    const admin = await createTestUser("Admin", "ADMIN");
    const fixture = await createRepo("OwnerFilter");

    const riskyReview = await createReview(fixture.db, fixture.fixture, {
      prNumber: 1,
      riskScore: 9,
      status: "FAILED",
    });
    await createReview(fixture.db, fixture.fixture, {
      prNumber: 2,
      riskScore: 1,
      status: "COMPLETED",
    });

    const risky = await adminReviewService.getAll(admin.db, { limit: 50, minRiskScore: 5 });
    expect(risky.items.map((item) => item.prNumber)).toEqual([1]);

    const failed = await adminReviewService.getAll(admin.db, { limit: 50, status: "FAILED" });
    expect(failed.items.map((item) => item.prNumber)).toEqual([1]);

    const withReadyFix = await adminReviewService.getAll(admin.db, {
      fixStatus: "READY_TO_APPLY",
      limit: 50,
    });
    expect(withReadyFix.items).toHaveLength(0);

    await fixture.db.generatedFix.create({
      data: {
        branch: "fix/ready",
        prAnalysisId: riskyReview.id,
        repoId: fixture.fixture.repoId,
        status: "READY_TO_APPLY",
        title: "Ready",
      },
    });

    const afterFix = await adminReviewService.getAll(admin.db, {
      fixStatus: "READY_TO_APPLY",
      limit: 50,
    });
    expect(afterFix.items).toHaveLength(1);
  });

  it("searches by owner, repository name and pull-request number", async () => {
    const admin = await createTestUser("Admin", "ADMIN");
    const fixture = await createRepo("OwnerSearch");

    await createReview(fixture.db, fixture.fixture, { owner: "searchable", prNumber: 7 });
    await createReview(fixture.db, fixture.fixture, { owner: "other", prNumber: 99 });

    const byOwner = await adminReviewService.getAll(admin.db, { limit: 50, search: "searchable" });
    expect(byOwner.items.map((item) => item.prNumber)).toEqual([7]);

    const byNumber = await adminReviewService.getAll(admin.db, { limit: 50, search: "99" });
    expect(byNumber.items.map((item) => item.prNumber)).toEqual([99]);

    const byRepo = await adminReviewService.getAll(admin.db, {
      limit: 50,
      search: "repo-ownersearch",
    });
    expect(byRepo.items).toHaveLength(2);
  });

  it("never returns a non-numeric search term as a pr number, which would be an invalid uuid filter", async () => {
    const admin = await createTestUser("Admin", "ADMIN");
    const fixture = await createRepo("OwnerSafe");

    await createReview(fixture.db, fixture.fixture, { prNumber: 3 });

    const result = await adminReviewService.getAll(admin.db, { limit: 50, search: "abc" });
    expect(result.items).toHaveLength(0);
  });

  it("paginates without repeating or dropping a review", async () => {
    const admin = await createTestUser("Admin", "ADMIN");
    const fixture = await createRepo("OwnerPage");

    for (let index = 1; index <= 7; index += 1) {
      await createReview(fixture.db, fixture.fixture, { prNumber: index });
    }

    const filter = { limit: 3, search: "repo-ownerpage" };
    const pages = await Promise.all([
      adminReviewService.getAll(admin.db, { ...filter, page: 1 }),
      adminReviewService.getAll(admin.db, { ...filter, page: 2 }),
      adminReviewService.getAll(admin.db, { ...filter, page: 3 }),
    ]);

    const ids = pages.flatMap((page) => page.items.map((item) => item.id));
    expect(new Set(ids).size).toBe(7);
    expect(pages[0].meta.totalPages).toBe(3);
    expect(pages[2].meta.hasNextPage).toBe(false);
  });

  it("reports a missing review as NOT_FOUND", async () => {
    const admin = await createTestUser("Admin", "ADMIN");

    await expect(
      adminReviewService.getDetail(admin.db, "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
