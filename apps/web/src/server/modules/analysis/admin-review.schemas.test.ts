import { describe, expect, it } from "vitest";

import { AdminReviewFilterSchema, AdminReviewListSchema } from "./admin-review.schemas";

const CURSOR = "0192f0c1-0000-7000-8000-000000000009";

describe("AdminReviewFilterSchema", () => {
  it("defaults the page size to the cursor page the table sends", () => {
    expect(AdminReviewFilterSchema.parse({}).limit).toBe(50);
  });

  it("takes a cursor instead of a page number", () => {
    expect(AdminReviewFilterSchema.parse({ cursor: CURSOR }).cursor).toBe(CURSOR);
    expect(AdminReviewFilterSchema.parse({ page: 3 })).not.toHaveProperty("page");
  });

  it("keeps status, fix status, risk and search filters", () => {
    const parsed = AdminReviewFilterSchema.parse({
      fixStatus: "DRAFT",
      minRiskScore: "6",
      search: "  acme ",
      status: "COMPLETED",
    });

    expect(parsed).toMatchObject({
      fixStatus: "DRAFT",
      minRiskScore: 6,
      search: "acme",
      status: "COMPLETED",
    });
  });

  it("rejects an inverted date range", () => {
    expect(
      AdminReviewFilterSchema.safeParse({ from: "2026-02-01", to: "2026-01-01" }).success,
    ).toBe(false);
  });
});

describe("AdminReviewListSchema", () => {
  it("accepts the cursor meta the service returns", () => {
    const parsed = AdminReviewListSchema.parse({
      items: [],
      meta: { hasNextPage: false },
    });

    expect(parsed.meta).toEqual({ hasNextPage: false });
  });
});
