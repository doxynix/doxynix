import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { MAX_PAGE, MAX_PAGE_SIZE } from "@doxynix/shared";
import { describe, expect, it } from "vitest";

import {
  clampPage,
  getPaginationMeta,
  ORDER_CREATED_AT_DESC,
  orderWithTiebreak,
  PaginationSchema,
} from "./pagination";

// Every offset-paginated list in the app, by the service that owns it. A new one is not covered
// until it is added here, which is the point: the list of paginated lists is short and known.
const PAGINATED_SERVICES = [
  "audit-logs/admin-audit.service.ts",
  "banned-emails/banned-email.service.ts",
  "notifications/notifications.service.ts",
  "repos/repo.service.ts",
  "users/admin-user.service.ts",
  "analysis/admin-review.service.ts",
];

const MODULES_DIR = join(dirname(fileURLToPath(import.meta.url)), "../modules");

function readService(relative: string): string {
  return readFileSync(join(MODULES_DIR, relative), "utf8");
}

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
      hasNextPage: true,
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
      hasNextPage: false,
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

  it("coerces and validates page, limit, and search zod input", () => {
    expect(PaginationSchema.parse({ limit: "20", page: "3", search: "  foo  " })).toMatchObject({
      limit: 20,
      page: 3,
      search: "foo",
    });

    expect(PaginationSchema.parse({})).toMatchObject({
      limit: 10,
    });

    expect(() => PaginationSchema.parse({ limit: 0 })).toThrow(
      "Too small: expected number to be >=1",
    );
    expect(() => PaginationSchema.parse({ page: 0 })).toThrow(
      "Too small: expected number to be >=1",
    );
  });

  it("keeps the server bounds on the shared constants the client clamps against", () => {
    // The client clamps `?page=` and the page-size param to these same constants, so raising one
    // side without the other is the drift this guards.
    expect(PaginationSchema.safeParse({ limit: MAX_PAGE_SIZE }).success).toBe(true);
    expect(PaginationSchema.safeParse({ limit: MAX_PAGE_SIZE + 1 }).success).toBe(false);
    expect(clampPage(MAX_PAGE)).toBe(MAX_PAGE);
    expect(clampPage(MAX_PAGE + 1)).toBe(MAX_PAGE);
  });

  it("flags a capped count so the UI can tell the user to narrow instead of implying the end", () => {
    const capped = getPaginationMeta({
      capped: true,
      filteredCount: 2000,
      limit: 20,
      page: 1,
      totalCount: 2000,
    });

    expect(capped.capped).toBe(true);

    // Absent, not false, when the count was exact — keeps the common payload unchanged.
    const exact = getPaginationMeta({ filteredCount: 35, limit: 10, page: 1, totalCount: 35 });
    expect(exact.capped).toBeUndefined();
  });
});

/**
 * `created_at` is not unique — `audit_logs` holds 245 000 groups of rows sharing a timestamp. An
 * order that does not end in a unique column is not an order at all: Postgres may return tied
 * rows in any sequence, so with `skip` a row can appear on two pages or on none. It is also the
 * slower of the two shapes, because an index on `(scope, created_at)` cannot serve
 * `ORDER BY created_at DESC, id DESC` and the planner falls back to materialising every matching
 * row and sorting before applying LIMIT. Measured: 803 ms → 0.66 ms on one user's notifications.
 *
 * The second failure mode — a new row shifting every later page while a user paginates — is not
 * fixable with a tiebreaker. It needs keyset, which gives up page numbers, and is a product
 * decision rather than a property this file can assert.
 */
describe("list ordering", () => {
  it("closes ORDER_CREATED_AT_DESC with the unique id column", () => {
    expect(ORDER_CREATED_AT_DESC.at(-1)).toEqual({ id: "desc" });
  });

  it("closes a caller-chosen sort column with the id, in the same direction", () => {
    expect(orderWithTiebreak("name", "asc")).toEqual([{ name: "asc" }, { id: "asc" }]);
    expect(orderWithTiebreak("updatedAt", "desc")).toEqual([{ updatedAt: "desc" }, { id: "desc" }]);
  });

  it.each(PAGINATED_SERVICES)("%s never orders by a non-unique column alone", (service) => {
    const source = readService(service);
    const violations: string[] = [];

    // An array form is always a deliberate composite order, so it must be closed.
    for (const match of source.matchAll(/orderBy:\s*\[([^\]]*)\]/g)) {
      const fields = match[1];
      if (!/\{\s*id\s*:\s*"(asc|desc)"\s*\}\s*$/.test(fields ?? "")) {
        violations.push(`unclosed composite orderBy: orderBy: [${fields}]`);
      }
    }

    // An object form is a single column. That is safe in two places: a pick-one (`take: 1`),
    // where any row of a tied group is an acceptable answer, and a nested relation inside a
    // parent's `select`, which is bounded by the parent's cardinality and is never paginated.
    // It is unsafe as the top-level order of a list, where the tie order decides which page a row
    // lands on. A nested relation is recognisable because the object literal is opened by a field
    // assignment (`generatedFixes: { … }`) rather than by a `findMany(` call.
    for (const match of source.matchAll(/orderBy:\s*\{\s*(createdAt|updatedAt)\s*:/g)) {
      const at = match.index;
      const before = source.slice(Math.max(0, at - 120), at);
      const nested = /\w+:\s*\{\s*$/.test(before);
      const pickOne = /(take|skip)\s*:\s*\d/.test(source.slice(at, at + 400));
      if (!nested && !pickOne) {
        violations.push(
          `orderBy: { ${match[1]}: … } with no id tiebreaker, no take and no enclosing relation`,
        );
      }
    }

    expect(violations).toEqual([]);
  });

  it("routes the caller-chosen sort column through the helper rather than an inline object", () => {
    // `repo.getAll` lets the caller pick `name | updatedAt | createdAt` and the direction, which
    // is six combinations; an inline object per branch is exactly how the tiebreaker got lost.
    expect(readService("repos/repo.service.ts")).toContain("orderWithTiebreak(sortBy, sortOrder)");
  });
});
