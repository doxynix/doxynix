import { describe, expect, it } from "vitest";

import { getPaginationMeta, PaginationSchema } from "./pagination";

describe("pagination", () => {
  it("builds page metadata for the next cursor and total pages", () => {
    expect(
      getPaginationMeta({
        filteredCount: 35,
        limit: 10,
        page: 2,
        totalCount: 35,
      }),
    ).toEqual({
      currentPage: 2,
      filteredCount: 35,
      nextCursor: 3,
      pageSize: 10,
      searchQuery: undefined,
      totalCount: 35,
      totalPages: 4,
    });
  });

  it("returns no next cursor on the last page and keeps the last page at minimum 1", () => {
    expect(
      getPaginationMeta({
        filteredCount: 0,
        limit: 10,
        page: 1,
        totalCount: 50,
      }),
    ).toEqual({
      currentPage: 1,
      filteredCount: 0,
      nextCursor: undefined,
      pageSize: 10,
      searchQuery: undefined,
      totalCount: 50,
      totalPages: 1,
    });
  });

  it("rejects invalid limits and pages", () => {
    expect(() =>
      getPaginationMeta({
        filteredCount: 5,
        limit: 0,
        page: 1,
        totalCount: 5,
      }),
    ).toThrow("Pagination limit must be a positive integer");

    expect(() =>
      getPaginationMeta({
        filteredCount: 5,
        limit: 2,
        page: 0,
        totalCount: 5,
      }),
    ).toThrow("Pagination page must be a positive integer");
  });

  it("coerces and validates cursor, limit, and search zod input", () => {
    expect(PaginationSchema.parse({ cursor: "3", limit: "20", search: "  foo  " })).toMatchObject({
      cursor: 3,
      limit: 20,
      search: "foo",
    });

    expect(PaginationSchema.parse({})).toMatchObject({
      limit: 10,
    });

    expect(() => PaginationSchema.parse({ limit: 0 })).toThrow(
      "Too small: expected number to be >=1",
    );
    expect(() => PaginationSchema.parse({ cursor: 0 })).toThrow(
      "Too small: expected number to be >=1",
    );
  });
});
