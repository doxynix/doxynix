import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createComment: vi.fn().mockResolvedValue({}),
  createFix: vi.fn(),
  getStore: vi.fn((): unknown => ({})),
  markdownToHtml: vi.fn(async (input: { content: string }) => `<p>${input.content}</p>`),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: () => unknown, _key?: unknown[], _options?: unknown) => fn),
}));

const FIX_ID = "018f0000-0000-7000-8000-0000000000f1";

vi.mock("next/cache", () => ({
  revalidateTag: mocks.revalidateTag,
  unstable_cache: mocks.unstable_cache,
}));
vi.mock("@/server/core/github/github-client", () => ({
  getInstallationClient: () => ({ rest: { issues: { createComment: mocks.createComment } } }),
}));
vi.mock("@/server/modules/analysis/services/fixes.service", () => ({
  fixesService: { createFix: mocks.createFix },
}));
vi.mock("@/server/modules/analysis/services/markdown-to-html", () => ({
  markdownToHtml: mocks.markdownToHtml,
}));
vi.mock("@/server/utils/request-context", () => ({
  requestContext: { getStore: mocks.getStore },
}));

import type { DbClient } from "@/server/core/db";

import { MAX_FIXABLE_COMMENTS, prCommentsService } from "./pr-comments.service";

const ANALYSIS_ID = "018f0000-0000-7000-8000-0000000000aa";
const REPO_ID = "018f0000-0000-7000-8000-0000000000cc";
const CURSOR = "018f0000-0000-7000-8000-0000000000c1";

const ANALYSIS_VERSION = new Date("2026-03-01T12:00:00.000Z");
const VERSION_KEY = ANALYSIS_VERSION.getTime();

function makeComment(index: number, updatedAt: Date = ANALYSIS_VERSION) {
  return {
    analysis: { repo: { name: "doxynix", owner: "ivan" }, updatedAt },
    body: `comment ${index}`,
    filePath: `src/file-${index}.ts`,
    findingType: "BUG",
    id: `018f0000-0000-7000-8000-00000000000${index}`,
    line: index,
    riskLevel: 5,
  };
}

function stubDb(comments: unknown[], total = comments.length) {
  const findMany = vi.fn().mockResolvedValue(comments);
  const count = vi.fn().mockResolvedValue(total);
  const db = { pullRequestComment: { count, findMany } } as unknown as DbClient;

  return { count, db, findMany };
}

function stubMutationDb() {
  const create = vi.fn().mockResolvedValue({ id: "018f0000-0000-7000-8000-0000000000d1" });

  const db = {
    githubInstallation: { findFirst: vi.fn().mockResolvedValue({ id: "42" }) },
    pullRequestAnalysis: { findFirst: vi.fn().mockResolvedValue({ id: ANALYSIS_ID }) },
    pullRequestComment: { create },
    repo: {
      findUnique: vi.fn().mockResolvedValue({ id: REPO_ID, name: "doxynix", owner: "ivan" }),
    },
  } as unknown as DbClient;

  return { create, db };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getStore.mockReturnValue({});
  mocks.unstable_cache.mockImplementation((fn: () => unknown) => fn);
  mocks.markdownToHtml.mockImplementation(
    async (input: { content: string }) => `<p>${input.content}</p>`,
  );
  mocks.createFix.mockResolvedValue({ fixId: FIX_ID, status: "PENDING", success: true });
});

describe("prCommentsService.getComments", () => {
  it("renders a three-comment page through a single cache entry", async () => {
    const comments = [1, 2, 3].map((index) => makeComment(index));
    const { db, findMany } = stubDb(comments);

    const result = await prCommentsService.getComments(db, ANALYSIS_ID, "ws-1", { limit: 100 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { analysis: { id: ANALYSIS_ID, repo: { workspaceId: "ws-1" } } },
      }),
    );
    expect(mocks.unstable_cache).toHaveBeenCalledTimes(1);
    expect(mocks.unstable_cache).toHaveBeenCalledWith(
      expect.any(Function),
      [`pr-comments-html-ws-1-${ANALYSIS_ID}-${VERSION_KEY}-start-100`],
      { revalidate: 3600, tags: ["comments", ANALYSIS_ID, "ws-1"] },
    );
    expect(mocks.markdownToHtml).toHaveBeenCalledTimes(3);
    expect(result.renderedComments).toStrictEqual([
      {
        bodyHtml: "<p>comment 1</p>",
        filePath: "src/file-1.ts",
        findingType: "BUG",
        id: "018f0000-0000-7000-8000-000000000001",
        line: 1,
        riskLevel: 5,
      },
      {
        bodyHtml: "<p>comment 2</p>",
        filePath: "src/file-2.ts",
        findingType: "BUG",
        id: "018f0000-0000-7000-8000-000000000002",
        line: 2,
        riskLevel: 5,
      },
      {
        bodyHtml: "<p>comment 3</p>",
        filePath: "src/file-3.ts",
        findingType: "BUG",
        id: "018f0000-0000-7000-8000-000000000003",
        line: 3,
        riskLevel: 5,
      },
    ]);
  });

  it("orders by file and line with the id as the tiebreak the cursor needs", async () => {
    const { db, findMany } = stubDb([makeComment(1)]);

    await prCommentsService.getComments(db, ANALYSIS_ID, "ws-1", { limit: 100 });

    expect(findMany.mock.calls[0]?.[0]?.orderBy).toStrictEqual([
      { filePath: "asc" },
      { line: "asc" },
      { id: "asc" },
    ]);
  });

  it("reads one probe row past the page and reports it as the next cursor", async () => {
    const comments = [1, 2, 3].map((index) => makeComment(index));
    const { db, findMany } = stubDb(comments, 620);

    const result = await prCommentsService.getComments(db, ANALYSIS_ID, "ws-1", { limit: 2 });

    expect(findMany.mock.calls[0]?.[0]).toMatchObject({ cursor: undefined, take: 3 });
    expect(result.renderedComments.map((comment) => comment.id)).toStrictEqual([
      "018f0000-0000-7000-8000-000000000001",
      "018f0000-0000-7000-8000-000000000002",
    ]);
    expect(result.meta).toStrictEqual({
      hasNextPage: true,
      nextCursor: "018f0000-0000-7000-8000-000000000003",
    });
  });

  it("keysets past the cursor id instead of a page offset", async () => {
    const { db, count, findMany } = stubDb([makeComment(4)], 620);

    const result = await prCommentsService.getComments(db, ANALYSIS_ID, "ws-1", {
      cursor: CURSOR,
      limit: 3,
    });

    expect(findMany.mock.calls[0]?.[0]).toMatchObject({ cursor: { id: CURSOR }, take: 4 });
    // A later page must not pay for a COUNT(*), so the total stays unknown there.
    expect(count).not.toHaveBeenCalled();
    expect(result.total).toBeNull();
    expect(result.meta).toStrictEqual({ hasNextPage: false, nextCursor: undefined });
  });

  it("counts the first page once, on the same where as the page", async () => {
    const { count, db } = stubDb([makeComment(1)], 620);

    const result = await prCommentsService.getComments(db, ANALYSIS_ID, "ws-1", { limit: 100 });

    expect(count).toHaveBeenCalledWith({
      where: { analysis: { id: ANALYSIS_ID, repo: { workspaceId: "ws-1" } } },
    });
    expect(result.total).toBe(620);
  });

  it("puts the cursor and the limit in the cache key, so two pages cannot share an entry", async () => {
    await prCommentsService.getComments(stubDb([makeComment(1)]).db, ANALYSIS_ID, "ws-1", {
      limit: 100,
    });
    await prCommentsService.getComments(stubDb([makeComment(4)]).db, ANALYSIS_ID, "ws-1", {
      cursor: CURSOR,
      limit: 100,
    });
    await prCommentsService.getComments(stubDb([makeComment(1)]).db, ANALYSIS_ID, "ws-1", {
      limit: 50,
    });

    expect(mocks.unstable_cache.mock.calls[0]?.[1]).toStrictEqual([
      `pr-comments-html-ws-1-${ANALYSIS_ID}-${VERSION_KEY}-start-100`,
    ]);
    expect(mocks.unstable_cache.mock.calls[1]?.[1]).toStrictEqual([
      `pr-comments-html-ws-1-${ANALYSIS_ID}-${VERSION_KEY}-${CURSOR}-100`,
    ]);
    expect(mocks.unstable_cache.mock.calls[2]?.[1]).toStrictEqual([
      `pr-comments-html-ws-1-${ANALYSIS_ID}-${VERSION_KEY}-start-50`,
    ]);
  });

  it("keys the entry on the workspace, so the same analysis id cannot cross tenants", async () => {
    const comments = [makeComment(1)];

    await prCommentsService.getComments(
      stubDb(comments).db,
      ANALYSIS_ID,
      "018f0000-0000-7000-8000-0000000000e1",
      { limit: 100 },
    );
    await prCommentsService.getComments(
      stubDb(comments).db,
      ANALYSIS_ID,
      "018f0000-0000-7000-8000-0000000000e2",
      { limit: 100 },
    );

    expect(mocks.unstable_cache.mock.calls[0]?.[1]).toStrictEqual([
      `pr-comments-html-018f0000-0000-7000-8000-0000000000e1-${ANALYSIS_ID}-${VERSION_KEY}-start-100`,
    ]);
    expect(mocks.unstable_cache.mock.calls[1]?.[1]).toStrictEqual([
      `pr-comments-html-018f0000-0000-7000-8000-0000000000e2-${ANALYSIS_ID}-${VERSION_KEY}-start-100`,
    ]);
    expect(mocks.unstable_cache.mock.calls[0]?.[1]).not.toStrictEqual(
      mocks.unstable_cache.mock.calls[1]?.[1],
    );
  });

  it("misses the cached page when the analysis row is re-analysed in place", async () => {
    const bumped = new Date("2026-03-01T13:00:00.000Z");

    await prCommentsService.getComments(stubDb([makeComment(1)]).db, ANALYSIS_ID, "ws-1", {
      limit: 100,
    });
    await prCommentsService.getComments(stubDb([makeComment(1, bumped)]).db, ANALYSIS_ID, "ws-1", {
      limit: 100,
    });

    expect(mocks.unstable_cache.mock.calls[0]?.[1]).toStrictEqual([
      `pr-comments-html-ws-1-${ANALYSIS_ID}-${VERSION_KEY}-start-100`,
    ]);
    expect(mocks.unstable_cache.mock.calls[1]?.[1]).toStrictEqual([
      `pr-comments-html-ws-1-${ANALYSIS_ID}-${bumped.getTime()}-start-100`,
    ]);
  });

  it("does not cache an empty page", async () => {
    const { db } = stubDb([]);

    const result = await prCommentsService.getComments(db, ANALYSIS_ID, "ws-1", { limit: 100 });

    expect(mocks.unstable_cache).not.toHaveBeenCalled();
    expect(mocks.markdownToHtml).not.toHaveBeenCalled();
    expect(result).toStrictEqual({
      meta: { hasNextPage: false, nextCursor: undefined },
      renderedComments: [],
      total: 0,
    });
  });
});

describe("prCommentsService.fixAllComments", () => {
  const WORKSPACE_ID = "ws-1";

  function stubFixDb(rows: unknown[], analysis: unknown = { repo: { id: REPO_ID } }) {
    const findFirst = vi.fn().mockResolvedValue(analysis);
    const findMany = vi.fn().mockResolvedValue(rows);
    const db = {
      pullRequestAnalysis: { findFirst },
      pullRequestComment: { findMany },
    } as unknown as DbClient;

    return { db, findFirst, findMany };
  }

  const ROWS = [
    { body: "first body", filePath: "src/b.ts", findingType: "BUG", line: 9 },
    { body: "second body", filePath: "src/a.ts", findingType: "SECURITY", line: 2 },
  ];

  it("builds one fix from every comment of the analysis, not from a loaded page", async () => {
    const { db, findMany } = stubFixDb(ROWS);

    const result = await prCommentsService.fixAllComments(db, "user-1", ANALYSIS_ID, WORKSPACE_ID);

    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { analysis: { id: ANALYSIS_ID, repo: { workspaceId: WORKSPACE_ID } } },
    });
    expect(mocks.createFix).toHaveBeenCalledTimes(1);
    expect(mocks.createFix).toHaveBeenCalledWith(
      db,
      "user-1",
      {
        fileContents: {},
        findings: [
          { file: "src/b.ts", line: 9, suggestion: "first body", type: "bug" },
          { file: "src/a.ts", line: 2, suggestion: "second body", type: "security" },
        ],
        prAnalysisId: ANALYSIS_ID,
        repoId: REPO_ID,
      },
      WORKSPACE_ID,
    );
    expect(result).toStrictEqual({ fixId: FIX_ID, status: "PENDING", success: true });
  });

  it("reads the whole analysis under the workspace-scoped analysis row", async () => {
    const { db, findFirst, findMany } = stubFixDb(ROWS);

    await prCommentsService.fixAllComments(db, "user-1", ANALYSIS_ID, WORKSPACE_ID);

    expect(findFirst.mock.calls[0]?.[0]).toMatchObject({
      where: { id: ANALYSIS_ID, repo: { workspaceId: WORKSPACE_ID } },
    });
    expect(findMany.mock.calls[0]?.[0]?.take).toBe(MAX_FIXABLE_COMMENTS);
  });

  it("refuses an analysis outside the workspace before creating anything", async () => {
    const { db } = stubFixDb(ROWS, null);

    await expect(
      prCommentsService.fixAllComments(db, "user-1", ANALYSIS_ID, WORKSPACE_ID),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.createFix).not.toHaveBeenCalled();
  });

  it("reports an analysis without comments rather than triggering an empty fix", async () => {
    const { db } = stubFixDb([]);

    const result = await prCommentsService.fixAllComments(db, "user-1", ANALYSIS_ID, WORKSPACE_ID);

    expect(result).toStrictEqual({ error: "No comments to fix", success: false });
    expect(mocks.createFix).not.toHaveBeenCalled();
  });
});

describe("prCommentsService.postCommentToPR", () => {
  const input = { body: "hello", prNumber: 7, repoId: REPO_ID };

  it("revalidates the analysis tag after the comment is stored", async () => {
    const { db, create } = stubMutationDb();

    const result = await prCommentsService.postCommentToPR(db, input, "ws-1");

    expect(create).toHaveBeenCalledTimes(1);
    expect(mocks.revalidateTag).toHaveBeenCalledTimes(1);
    expect(mocks.revalidateTag).toHaveBeenCalledWith(ANALYSIS_ID, { expire: 0 });
    expect(result).toStrictEqual({
      commentId: "018f0000-0000-7000-8000-0000000000d1",
      success: true,
    });
  });

  it("skips revalidation when there is no request scope to revalidate from", async () => {
    mocks.getStore.mockReturnValue(undefined);
    const { db } = stubMutationDb();

    await prCommentsService.postCommentToPR(db, input, "ws-1");

    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });
});
