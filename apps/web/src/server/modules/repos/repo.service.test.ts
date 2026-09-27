import { PublicRepoSchema, Status, Visibility } from "@doxynix/shared";
import { describe, expect, it, vi } from "vitest";

import type { DbClient } from "@/server/core/db";
import { repoService } from "@/server/modules/repos/repo.service";
import { clampPage, PaginationSchema } from "@/server/utils/pagination";

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

const MAX_PAGE = 1_000_000;

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
    id: 1,
    language: "TypeScript",
    license: "MIT",
    name: "test-repo",
    openIssues: 3,
    owner: "test-owner",
    ownerAvatarUrl: null,
    publicId: "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
    pushedAt: new Date("2025-01-15"),
    size: 1024,
    stars: 42,
    topics: ["test"],
    updatedAt: new Date("2025-01-15"),
    url: "https://github.com/test-owner/test-repo",
    userId: 1,
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

  it("should share its cap with PaginationSchema", () => {
    expect(PaginationSchema.safeParse({ cursor: MAX_PAGE }).success).toBe(true);
    expect(PaginationSchema.safeParse({ cursor: MAX_PAGE + 1 }).success).toBe(false);
  });
});

describe("repoService.getAll page clamping", () => {
  it.each([
    { cursor: 0, expectedSkip: 0, label: "zero" },
    { cursor: 1, expectedSkip: 0, label: "one" },
    { cursor: -5, expectedSkip: 0, label: "negative" },
    { cursor: undefined, expectedSkip: 0, label: "missing" },
    { cursor: 3, expectedSkip: 20, label: "in range" },
  ])(
    "should translate a $label cursor into skip $expectedSkip",
    async ({ cursor, expectedSkip }) => {
      const { db, findMany } = createRepoDbMock();

      await repoService.getAll(db, { ...REPO_INPUT, cursor, limit: 10 });

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: expectedSkip, take: 10 }),
      );
    },
  );

  it("should cap a cursor above the maximum so skip cannot explode", async () => {
    const { db, findMany } = createRepoDbMock();

    await repoService.getAll(db, { ...REPO_INPUT, cursor: MAX_PAGE + 1, limit: 100 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: (MAX_PAGE - 1) * 100, take: 100 }),
    );
  });

  it("should report the clamped page in the meta", async () => {
    const { db } = createRepoDbMock();

    const result = await repoService.getAll(db, { ...REPO_INPUT, cursor: 0 });

    expect(result.meta.currentPage).toBe(1);
    expect(result.meta.pageSize).toBe(10);
  });
});

describe("repoService.getSlim page clamping", () => {
  it.each([
    { cursor: 0, expectedSkip: 0, label: "zero" },
    { cursor: -5, expectedSkip: 0, label: "negative" },
    { cursor: undefined, expectedSkip: 0, label: "missing" },
    { cursor: 4, expectedSkip: 30, label: "in range" },
  ])(
    "should translate a $label cursor into skip $expectedSkip",
    async ({ cursor, expectedSkip }) => {
      const { db, findMany } = createRepoDbMock();

      await repoService.getSlim(db, { ...REPO_INPUT, cursor, limit: 10 });

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: expectedSkip, take: 10 }),
      );
    },
  );

  it("should cap a cursor above the maximum so skip cannot explode", async () => {
    const { db, findMany } = createRepoDbMock();

    await repoService.getSlim(db, { ...REPO_INPUT, cursor: MAX_PAGE + 1, limit: 100 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: (MAX_PAGE - 1) * 100, take: 100 }),
    );
  });

  it("should return the next cursor relative to the clamped page", async () => {
    const { count, db } = createRepoDbMock();
    count.mockResolvedValue(1000);

    const result = await repoService.getSlim(db, { ...REPO_INPUT, cursor: 0, limit: 10 });

    expect(result.meta.nextCursor).toBe(2);
    expect(result.meta.totalCount).toBe(1000);
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
