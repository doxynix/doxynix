import { Status, Visibility } from "@doxynix/shared";
import { describe, expect, it } from "vitest";

import { RepoFilterSchema } from "./repo.schemas";

describe("RepoFilterSchema", () => {
  it("applies default values for pagination and sorting", () => {
    const parsed = RepoFilterSchema.parse({});

    expect(parsed).toEqual({
      limit: 10,
      sortBy: "updatedAt",
      sortOrder: "desc",
    });
  });

  it("parses valid filter parameters and trims owner string", () => {
    const parsed = RepoFilterSchema.parse({
      cursor: 2,
      limit: 25,
      owner: "  doxynix  ",
      search: "react",
      sortBy: "name",
      sortOrder: "asc",
      status: Status.DONE,
      visibility: Visibility.PUBLIC,
    });

    expect(parsed).toEqual({
      cursor: 2,
      limit: 25,
      owner: "doxynix",
      search: "react",
      sortBy: "name",
      sortOrder: "asc",
      status: Status.DONE,
      visibility: Visibility.PUBLIC,
    });
  });

  it("rejects invalid cursor, limit, and enum values", () => {
    expect(RepoFilterSchema.safeParse({ cursor: -1 }).success).toBe(false);
    expect(RepoFilterSchema.safeParse({ cursor: 0 }).success).toBe(false);
    expect(RepoFilterSchema.safeParse({ cursor: 1_000_001 }).success).toBe(false);
    expect(RepoFilterSchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(RepoFilterSchema.safeParse({ limit: 101 }).success).toBe(false);
    expect(RepoFilterSchema.safeParse({ sortBy: "invalidField" }).success).toBe(false);
    expect(RepoFilterSchema.safeParse({ sortOrder: "sideways" }).success).toBe(false);
    expect(RepoFilterSchema.safeParse({ status: "UNKNOWN_STATUS" }).success).toBe(false);
    expect(RepoFilterSchema.safeParse({ owner: "" }).success).toBe(false);
  });
});
