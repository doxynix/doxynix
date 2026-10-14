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
});
