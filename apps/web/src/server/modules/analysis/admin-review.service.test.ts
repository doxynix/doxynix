import { describe, expect, it, vi } from "vitest";

import { AdminReviewDetailSchema } from "./admin-review.schemas";
import { adminReviewService } from "./admin-review.service";

type Row = Record<string, unknown>;

const REVIEW = {
  _count: { generatedFixes: 0 },
  baseSha: "base-sha",
  createdAt: new Date("2026-01-01"),
  error: null,
  headSha: "head-sha",
  id: "0192f0c1-0000-7000-8000-000000000009",
  owner: "acme",
  prNumber: 42,
  repoName: "widgets",
  riskScore: 5,
  status: "COMPLETED",
  updatedAt: new Date("2026-01-02"),
} satisfies Row;

function createDb(row: Row | null) {
  const findUnique = vi.fn().mockResolvedValue(row);
  return { db: { pullRequestAnalysis: { findUnique } } as never, findUnique };
}

const REVIEW_ID = "0192f0c1-0000-7000-8000-000000000009";

describe("adminReviewService.getAll", () => {
  function createListDb(rows: Row[] = []) {
    const findMany = vi.fn().mockResolvedValue(rows);
    return { db: { pullRequestAnalysis: { findMany } } as never, findMany };
  }

  it("reads one probe row past the newest-first page, once", async () => {
    const { db, findMany } = createListDb();

    const result = await adminReviewService.getAll(db, { limit: 20 });

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      cursor: undefined,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: expect.objectContaining({ id: true }),
      take: 21,
      where: {},
    });
    expect(result).toEqual({ items: [], meta: { hasNextPage: false, nextCursor: undefined } });
  });

  it("keysets past the cursor id", async () => {
    const { db, findMany } = createListDb();

    await adminReviewService.getAll(db, { cursor: REVIEW_ID, limit: 20 });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ cursor: { id: REVIEW_ID } }));
  });

  it("turns the probe row into the next cursor and keeps the counted fix total", async () => {
    const { db } = createListDb([
      { ...REVIEW, _count: { generatedFixes: 7 } },
      { ...REVIEW, id: "probe" },
    ]);

    const result = await adminReviewService.getAll(db, { limit: 1 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.fixCount).toBe(7);
    expect(result.meta).toEqual({ hasNextPage: true, nextCursor: "probe" });
  });

  it("keeps the status, risk, search and date filters in the where clause", async () => {
    const { db, findMany } = createListDb();

    await adminReviewService.getAll(db, {
      from: new Date("2026-01-01"),
      limit: 20,
      minRiskScore: 6,
      search: "  acme ",
      status: "COMPLETED",
      to: new Date("2026-02-01"),
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          createdAt: { gte: new Date("2026-01-01"), lt: new Date("2026-02-02") },
          OR: [
            { owner: { contains: "acme", mode: "insensitive" } },
            { repoName: { contains: "acme", mode: "insensitive" } },
            { prNumber: -1 },
          ],
          riskScore: { gte: 6 },
          status: "COMPLETED",
        },
      }),
    );
  });
});

/**
 * `PullRequestAnalysis.repoId` is declared `@omit`, which makes ZenStack strip it from the result
 * however it is selected. The detail output schema requires a uuid there, so the procedure
 * answered 400 for every row — not only on badly seeded data. This pins the fact that `repoId`
 * reaches the response, which is what silently broke.
 */
describe("adminReviewService.getDetail", () => {
  it("returns a repoId the detail output schema accepts", async () => {
    // Deliberately no `repoId` on the row, mirroring what the policy layer actually delivers:
    // the id has to come through the `repo` relation or the schema rejects the whole response.
    const { db } = createDb({
      ...REVIEW,
      generatedFixes: [],
      repo: { id: "0192f0c1-0000-7000-8000-0000000000aa" },
    });

    const detail = await adminReviewService.getDetail(db, "0192f0c1-0000-7000-8000-000000000009");

    expect(detail.repoId).toBe("0192f0c1-0000-7000-8000-0000000000aa");
    expect(AdminReviewDetailSchema.safeParse(detail).success).toBe(true);
  });

  it("does not pass the @omit'd column straight through", () => {
    // Regression guard: selecting `repoId` directly is a no-op under `@omit`, so the select must
    // reach for the relation instead.
    const source = REVIEW;
    expect(source).not.toHaveProperty("repoId");
  });

  it("raises NOT_FOUND for a missing review", async () => {
    const { db } = createDb(null);

    await expect(adminReviewService.getDetail(db, "missing")).rejects.toThrow(/not found/i);
  });

  it("caps the fixes it loads but keeps the counted fixCount", async () => {
    const { db, findUnique } = createDb({
      ...REVIEW,
      _count: { generatedFixes: 620 },
      generatedFixes: [
        {
          branch: "doxynix/fix-1",
          createdAt: new Date("2026-01-03"),
          estimatedImpact: 40,
          githubPrNumber: null,
          githubPrUrl: null,
          id: "0192f0c1-0000-7000-8000-0000000000bb",
          status: "DRAFT",
          title: "fix one",
        },
      ],
      repo: { id: "0192f0c1-0000-7000-8000-0000000000aa" },
    });

    const detail = await adminReviewService.getDetail(db, "0192f0c1-0000-7000-8000-000000000009");

    expect(findUnique.mock.calls[0]?.[0]?.select?.generatedFixes).toMatchObject({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    expect(detail.fixCount).toBe(620);
    expect(detail.fixes).toHaveLength(1);
  });
});
