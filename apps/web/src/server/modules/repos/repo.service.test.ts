import { MAX_PAGE, PublicRepoSchema, Status, Visibility } from "@doxynix/shared";
import { describe, expect, it, vi } from "vitest";

import type { DbClient } from "@/server/core/db";
import { repoService } from "@/server/modules/repos/repo.service";
import { clampPage, getPaginationMeta, PaginationSchema } from "@/server/utils/pagination";

function buildSearchClause(term: string) {
  return {
    OR: [
      { name: { contains: term, mode: "insensitive" } },
      { owner: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
    ],
  };
}

const NEW_STATUS_FILTER = {
  OR: [{ analyses: { none: {} } }, { analyses: { some: { status: Status.NEW } } }],
};

describe("repoService.buildWhereClause", () => {
  describe("no filters", () => {
    it("should return an empty object when no filters are provided", () => {
      expect(repoService.buildWhereClause({})).toEqual({});
    });

    it("should return an empty object when every filter is explicitly undefined", () => {
      expect(
        repoService.buildWhereClause({
          owner: undefined,
          search: undefined,
          status: undefined,
          visibility: undefined,
        }),
      ).toEqual({});
    });
  });

  describe("owner", () => {
    it("should match owner case-insensitively", () => {
      expect(repoService.buildWhereClause({ owner: "acme" })).toEqual({
        owner: { equals: "acme", mode: "insensitive" },
      });
    });

    it("should trim surrounding whitespace from owner", () => {
      expect(repoService.buildWhereClause({ owner: "  acme  " })).toEqual({
        owner: { equals: "acme", mode: "insensitive" },
      });
    });

    it("should drop an owner that is whitespace only", () => {
      expect(repoService.buildWhereClause({ owner: "   " })).toEqual({});
    });

    it("should drop an empty owner string", () => {
      expect(repoService.buildWhereClause({ owner: "" })).toEqual({});
    });

    it("should preserve owner casing rather than lowercasing it", () => {
      expect(repoService.buildWhereClause({ owner: "AcMe" })).toEqual({
        owner: { equals: "AcMe", mode: "insensitive" },
      });
    });
  });

  describe("status", () => {
    it("should emit the special no-analyses OR some-NEW filter for Status.NEW", () => {
      expect(repoService.buildWhereClause({ status: Status.NEW })).toEqual(NEW_STATUS_FILTER);
    });

    it.each([Status.DONE, Status.FAILED, Status.PENDING])(
      "should emit a plain analyses.some filter for Status.%s",
      (status) => {
        expect(repoService.buildWhereClause({ status })).toEqual({
          analyses: { some: { status } },
        });
      },
    );

    it("should not emit a status key when status is omitted", () => {
      expect(repoService.buildWhereClause({ owner: "acme" })).not.toHaveProperty("analyses");
      expect(repoService.buildWhereClause({})).not.toHaveProperty("analyses");
    });
  });

  describe("visibility", () => {
    it.each([Visibility.PRIVATE, Visibility.PUBLIC])(
      "should pass visibility %s straight through",
      (visibility) => {
        expect(repoService.buildWhereClause({ visibility })).toEqual({ visibility });
      },
    );

    it("should not emit a visibility key when omitted", () => {
      expect(repoService.buildWhereClause({})).not.toHaveProperty("visibility");
    });
  });

  describe("search", () => {
    it("should yield only the raw filter for a single-word search", () => {
      expect(repoService.buildWhereClause({ search: "React" })).toEqual(buildSearchClause("react"));
    });

    it("should trim and lowercase a single-word search", () => {
      expect(repoService.buildWhereClause({ search: "  ReAcT  " })).toEqual(
        buildSearchClause("react"),
      );
    });

    it("should yield OR[raw, tokenised] for a multi-word search", () => {
      expect(repoService.buildWhereClause({ search: "  React Query  " })).toEqual({
        OR: [
          buildSearchClause("react query"),
          { AND: [buildSearchClause("react"), buildSearchClause("query")] },
        ],
      });
    });

    it("should tokenise on hyphens and slashes and keep the raw term", () => {
      expect(repoService.buildWhereClause({ search: "@tanstack/react-query" })).toEqual({
        OR: [
          buildSearchClause("@tanstack/react-query"),
          {
            AND: [
              buildSearchClause("tanstack"),
              buildSearchClause("react"),
              buildSearchClause("query"),
            ],
          },
        ],
      });
    });

    it("should deduplicate repeated tokens", () => {
      expect(repoService.buildWhereClause({ search: "react react query" })).toEqual({
        OR: [
          buildSearchClause("react react query"),
          { AND: [buildSearchClause("react"), buildSearchClause("query")] },
        ],
      });
    });

    it("should return an empty object for a whitespace-only search", () => {
      expect(repoService.buildWhereClause({ search: "   " })).toEqual({});
    });

    it("should return an empty object for an empty search string", () => {
      expect(repoService.buildWhereClause({ search: "" })).toEqual({});
    });

    it("should keep the surviving token when the raw search has sub-2-char words", () => {
      expect(repoService.buildWhereClause({ search: "a react" })).toEqual({
        OR: [buildSearchClause("a react"), { AND: [buildSearchClause("react")] }],
      });
    });

    it("should fall back to the literal phrase when every token is sub-2-char", () => {
      expect(repoService.buildWhereClause({ search: "a b" })).toEqual(buildSearchClause("a b"));
    });
  });

  describe("status composed with search (both constraints survive)", () => {
    it("should keep the Status.NEW filter when combined with a single-word search", () => {
      expect(repoService.buildWhereClause({ search: "react", status: Status.NEW })).toEqual({
        AND: [NEW_STATUS_FILTER, buildSearchClause("react")],
      });
    });

    it("should keep the Status.NEW filter when combined with a multi-word search", () => {
      expect(repoService.buildWhereClause({ search: "react query", status: Status.NEW })).toEqual({
        AND: [
          NEW_STATUS_FILTER,
          {
            OR: [
              buildSearchClause("react query"),
              { AND: [buildSearchClause("react"), buildSearchClause("query")] },
            ],
          },
        ],
      });
    });

    it("should keep a non-NEW status filter when combined with a search", () => {
      expect(repoService.buildWhereClause({ search: "react", status: Status.DONE })).toEqual({
        AND: [{ analyses: { some: { status: Status.DONE } } }, buildSearchClause("react")],
      });
    });
  });

  describe("combinations", () => {
    it("should combine owner, visibility, a non-NEW status and a multi-word search", () => {
      expect(
        repoService.buildWhereClause({
          owner: "  AcMe  ",
          search: "  React Query  ",
          status: Status.DONE,
          visibility: Visibility.PUBLIC,
        }),
      ).toEqual({
        AND: [
          { visibility: Visibility.PUBLIC },
          { owner: { equals: "AcMe", mode: "insensitive" } },
          { analyses: { some: { status: Status.DONE } } },
          {
            OR: [
              buildSearchClause("react query"),
              { AND: [buildSearchClause("react"), buildSearchClause("query")] },
            ],
          },
        ],
      });
    });

    it("should combine owner and the Status.NEW special filter", () => {
      expect(repoService.buildWhereClause({ owner: "acme", status: Status.NEW })).toEqual({
        AND: [{ owner: { equals: "acme", mode: "insensitive" } }, NEW_STATUS_FILTER],
      });
    });

    it("should not nest the fragments under AND when only one filter is present", () => {
      expect(repoService.buildWhereClause({ status: Status.NEW })).not.toHaveProperty("AND");
      expect(repoService.buildWhereClause({ owner: "acme" })).not.toHaveProperty("AND");
      expect(repoService.buildWhereClause({ search: "react" })).not.toHaveProperty("AND");
      expect(repoService.buildWhereClause({})).not.toHaveProperty("AND");
    });
  });
});

function createRepoDbMock(rows: unknown[] = [], first: unknown = null) {
  const count = vi.fn().mockResolvedValue(0);
  const findFirst = vi.fn().mockResolvedValue(first);
  const findMany = vi.fn().mockResolvedValue(rows);

  const db = { repo: { count, findFirst, findMany } } as unknown as DbClient;

  return { count, db, findFirst, findMany };
}

function makeRepoRecord(overrides?: Record<string, unknown>) {
  return {
    createdAt: new Date("2025-01-01"),
    defaultBranch: "main",
    description: "A test repo",
    forks: 7,
    githubCreatedAt: new Date("2024-01-01"),
    githubId: 12_345,
    id: "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
    language: "TypeScript",
    license: "MIT",
    name: "test-repo",
    openIssues: 3,
    owner: "test-owner",
    ownerAvatarUrl: null,
    pushedAt: new Date("2025-01-15"),
    size: 1024,
    stars: 42,
    topics: ["test"],
    updatedAt: new Date("2025-01-15"),
    url: "https://github.com/test-owner/test-repo",
    userId: "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d",
    visibility: Visibility.PUBLIC,
    ...overrides,
  };
}

const REPO_INPUT = {
  limit: 10,
  sortBy: "updatedAt",
  sortOrder: "desc",
} as const;

describe("clampPage", () => {
  it("should return the first page for a missing or null cursor", () => {
    expect(clampPage(undefined)).toBe(1);
    expect(clampPage(null)).toBe(1);
  });

  it.each([0, 1, -1, -1_000_000])("should return %i unchanged when it is a valid page", (page) => {
    expect(clampPage(page)).toBe(Math.max(1, page));
  });

  it("should clamp non-positive pages up to the first page", () => {
    expect(clampPage(0)).toBe(1);
    expect(clampPage(-1)).toBe(1);
    expect(clampPage(-999_999)).toBe(1);
  });

  it("should keep a page inside the range untouched", () => {
    expect(clampPage(2)).toBe(2);
    expect(clampPage(MAX_PAGE)).toBe(MAX_PAGE);
  });

  it("should clamp a page above the cap down to the cap", () => {
    expect(clampPage(MAX_PAGE + 1)).toBe(MAX_PAGE);
    expect(clampPage(Number.MAX_SAFE_INTEGER)).toBe(MAX_PAGE);
  });

  it("should never advertise a page that clampPage would refuse", () => {
    // The count is capped at MAX_PAGE * limit, so totalPages must land exactly on MAX_PAGE.
    // With a `+ 1` in the cap it came out at 101 and the pager rendered a dead link.
    const limit = 20;
    const meta = getPaginationMeta({
      filteredCount: MAX_PAGE * limit,
      limit,
      page: 1,
      totalCount: MAX_PAGE * limit,
    });

    expect(meta.totalPages).toBe(MAX_PAGE);
    expect(clampPage(meta.totalPages)).toBe(meta.totalPages);
  });

  it("should accept an out-of-range page and leave the clamping to clampPage", () => {
    expect(PaginationSchema.safeParse({ cursor: MAX_PAGE }).success).toBe(true);

    const far = PaginationSchema.parse({ page: Number.MAX_SAFE_INTEGER });
    expect(clampPage(far.page)).toBe(MAX_PAGE);
  });
});

describe("repoService.getAll page clamping", () => {
  it.each([
    { expectedSkip: 0, label: "zero", page: 0 },
    { expectedSkip: 0, label: "one", page: 1 },
    { expectedSkip: 0, label: "negative", page: -5 },
    { expectedSkip: 0, label: "missing", page: undefined },
    { expectedSkip: 20, label: "in range", page: 3 },
  ])("should translate a $label page into skip $expectedSkip", async ({ expectedSkip, page }) => {
    const { db, findMany } = createRepoDbMock();

    await repoService.getAll(db, { ...REPO_INPUT, limit: 10, page }, "user-1");

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: expectedSkip, take: 10 }),
    );
  });

  it("should cap a page above the maximum so skip cannot explode", async () => {
    const { db, findMany } = createRepoDbMock();

    await repoService.getAll(db, { ...REPO_INPUT, limit: 100, page: MAX_PAGE + 1 }, "user-1");

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: (MAX_PAGE - 1) * 100, take: 100 }),
    );
  });

  it("should report the clamped page in the meta", async () => {
    const { db } = createRepoDbMock();

    const result = await repoService.getAll(db, { ...REPO_INPUT, page: 0 }, "user-1");

    expect(result.meta.currentPage).toBe(1);
    expect(result.meta.pageSize).toBe(10);
  });
});

describe("repoService.getSlim keyset", () => {
  it("should page by cursor and not by skip", async () => {
    const { db, findMany } = createRepoDbMock();

    await repoService.getSlim(
      db,
      {
        ...REPO_INPUT,
        cursor: "0192f0c1-0000-7000-8000-000000000001",
        limit: 10,
      },
      "user-1",
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: "0192f0c1-0000-7000-8000-000000000001" },
        take: 11,
      }),
    );
    expect(findMany.mock.calls[0]?.[0]).not.toHaveProperty("skip");
  });

  it("should report a cursor and hasNextPage on a full page", async () => {
    const { db, findMany } = createRepoDbMock();
    findMany.mockResolvedValueOnce(
      Array.from({ length: 11 }, (_, i) => ({ id: `r${i}`, name: "n", owner: "o" })),
    );

    const result = await repoService.getSlim(db, { ...REPO_INPUT, limit: 10 }, "user-1");

    expect(result.items).toHaveLength(10);
    expect(result.meta.hasNextPage).toBe(true);
    expect(result.meta.nextCursor).toBe("r10");
  });

  it("should close the page when the extra probe row is absent", async () => {
    const { db, findMany } = createRepoDbMock();
    findMany.mockResolvedValueOnce(
      Array.from({ length: 3 }, (_, i) => ({ id: `r${i}`, name: "n", owner: "o" })),
    );

    const result = await repoService.getSlim(db, { ...REPO_INPUT, limit: 10 }, "user-1");

    expect(result.meta.hasNextPage).toBe(false);
    expect(result.meta.nextCursor).toBeUndefined();
  });

  it("should serve every row exactly once across pages", async () => {
    const rows = Array.from({ length: 7 }, (_, i) => ({ id: `r${i}`, name: "n", owner: "o" }));
    const findMany = vi.fn(async (args: { cursor?: { id: string }; take: number }) => {
      const start = args.cursor == null ? 0 : rows.findIndex((row) => row.id === args.cursor?.id);
      return rows.slice(start, start + args.take);
    });
    const db = { repo: { findMany } } as unknown as DbClient;

    const seen: string[] = [];
    let cursor: string | undefined;

    for (let page = 0; page < 5; page += 1) {
      const result = await repoService.getSlim(db, { ...REPO_INPUT, cursor, limit: 3 }, "user-1");
      seen.push(...result.items.map((item) => item.id));
      cursor = result.meta.nextCursor;
      if (cursor == null) {
        break;
      }
    }

    expect(seen).toStrictEqual(rows.map((row) => row.id));
  });
});

describe("repoService.getByName", () => {
  it("should return null when no repo matches", async () => {
    const { db, findFirst } = createRepoDbMock([], null);

    await expect(repoService.getByName(db, "test-owner", "test-repo")).resolves.toBeNull();
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          name: { equals: "test-repo", mode: "insensitive" },
          owner: { equals: "test-owner", mode: "insensitive" },
        },
      }),
    );
  });

  it("should return the latest analysis status", async () => {
    const { db } = createRepoDbMock([], {
      ...makeRepoRecord(),
      analyses: [{ status: Status.DONE }],
    });

    const result = await repoService.getByName(db, "test-owner", "test-repo");

    expect(result?.status).toBe(Status.DONE);
    expect(result?.id).toBe("0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b");
  });

  it("should fall back to Status.NEW when there is no analysis", async () => {
    const { db } = createRepoDbMock([], { ...makeRepoRecord(), analyses: [] });

    const result = await repoService.getByName(db, "test-owner", "test-repo");

    expect(result?.status).toBe(Status.NEW);
  });

  it("should not return a message key", async () => {
    const { db } = createRepoDbMock([], { ...makeRepoRecord(), analyses: [] });

    const result = await repoService.getByName(db, "test-owner", "test-repo");

    expect(result).not.toHaveProperty("message");
  });

  it("should leak no internal column", async () => {
    const { db } = createRepoDbMock([], { ...makeRepoRecord(), analyses: [] });

    const result = await repoService.getByName(db, "test-owner", "test-repo");

    expect(Object.keys(result ?? {})).not.toContain("publicId");
    expect(Object.keys(result ?? {})).not.toContain("userId");
    expect(Object.keys(result ?? {})).not.toContain("analyses");
  });

  it("should satisfy PublicRepoSchema", async () => {
    const { db } = createRepoDbMock([], { ...makeRepoRecord(), analyses: [] });

    const result = await repoService.getByName(db, "test-owner", "test-repo");

    expect(() => PublicRepoSchema.parse(result)).not.toThrow();
  });
});

describe("repoService.getByOwner", () => {
  it("should return null when no repo matches", async () => {
    const { db } = createRepoDbMock([], null);

    await expect(repoService.getByOwner(db, "test-owner")).resolves.toBeNull();
  });

  it("should return status Status.NEW so the result validates against PublicRepoSchema", async () => {
    const { db } = createRepoDbMock([], makeRepoRecord());

    const result = await repoService.getByOwner(db, "test-owner");

    expect(result).toHaveProperty("status", Status.NEW);
    expect(() => PublicRepoSchema.parse(result)).not.toThrow();
  });

  it("should not return a message key", async () => {
    const { db } = createRepoDbMock([], makeRepoRecord());

    const result = await repoService.getByOwner(db, "test-owner");

    expect(result).not.toHaveProperty("message");
  });

  it("should leak no internal column", async () => {
    const { db } = createRepoDbMock([], makeRepoRecord());

    const result = await repoService.getByOwner(db, "test-owner");

    expect(Object.keys(result ?? {})).not.toContain("publicId");
    expect(Object.keys(result ?? {})).not.toContain("userId");
  });
});

describe("repoService.deleteAll", () => {
  function createDeleteAllDbMock() {
    const deleteMany = vi.fn().mockResolvedValue({ count: 0 });

    return { db: { repo: { deleteMany } } as unknown as DbClient, deleteMany };
  }

  // Deleting zero rows is an idempotent no-op, and the web client only toasts on success, so an empty list must still answer success.
  it("returns success when there is nothing to delete", async () => {
    const { db, deleteMany } = createDeleteAllDbMock();

    const result = await repoService.deleteAll(db, "user-1");

    expect(result).toStrictEqual({ success: true });
    expect(deleteMany).toHaveBeenCalledTimes(1);
  });

  // The ZenStack policy is `auth() == user || role == ADMIN`, so an unfiltered `deleteMany()`
  // meant "every repository on the platform" for an admin — reachable from their own settings
  // danger zone by pressing "delete all repos". The scope is stated in the query now, so this
  // fails if anyone removes it again.
  it("never issues an unfiltered delete, even for an admin", async () => {
    const { db, deleteMany } = createDeleteAllDbMock();

    await repoService.deleteAll(db, "admin-1");

    expect(deleteMany).toHaveBeenCalledWith({ where: { userId: "admin-1" } });
    const args = deleteMany.mock.calls[0]?.[0] as { where?: unknown } | undefined;
    expect(args?.where).toBeDefined();
  });
});
