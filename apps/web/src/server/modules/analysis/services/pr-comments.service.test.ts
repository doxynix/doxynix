import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createComment: vi.fn().mockResolvedValue({}),
  getStore: vi.fn((): unknown => ({})),
  markdownToHtml: vi.fn(async (input: { content: string }) => `<p>${input.content}</p>`),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: () => unknown, _key?: unknown[], _options?: unknown) => fn),
}));

vi.mock("next/cache", () => ({
  revalidateTag: mocks.revalidateTag,
  unstable_cache: mocks.unstable_cache,
}));
vi.mock("@/server/core/github/github-client", () => ({
  getInstallationClient: () => ({ rest: { issues: { createComment: mocks.createComment } } }),
}));
vi.mock("@/server/modules/analysis/services/markdown-to-html", () => ({
  markdownToHtml: mocks.markdownToHtml,
}));
vi.mock("@/server/utils/request-context", () => ({
  requestContext: { getStore: mocks.getStore },
}));

import type { DbClient } from "@/server/core/db";

import { prCommentsService } from "./pr-comments.service";

const ANALYSIS_ID = "018f0000-0000-7000-8000-0000000000aa";
const REPO_ID = "018f0000-0000-7000-8000-0000000000cc";

function makeComment(index: number) {
  return {
    analysis: { repo: { name: "doxynix", owner: "ivan" } },
    body: `comment ${index}`,
    filePath: `src/file-${index}.ts`,
    findingType: "BUG",
    id: `018f0000-0000-7000-8000-00000000000${index}`,
    line: index,
    riskLevel: 5,
  };
}

function stubDb(comments: unknown[]) {
  const findMany = vi.fn().mockResolvedValue(comments);
  const db = { pullRequestComment: { findMany } } as unknown as DbClient;

  return { db, findMany };
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
});
describe("prCommentsService.getComments", () => {
  it("renders a three-comment page through a single cache entry", async () => {
    const comments = [1, 2, 3].map((index) => makeComment(index));
    const { db, findMany } = stubDb(comments);

    const result = await prCommentsService.getComments(db, ANALYSIS_ID, "ws-1");

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { analysis: { id: ANALYSIS_ID, repo: { workspaceId: "ws-1" } } },
      }),
    );
    expect(mocks.unstable_cache).toHaveBeenCalledTimes(1);
    expect(mocks.unstable_cache).toHaveBeenCalledWith(
      expect.any(Function),
      [`pr-comments-html-ws-1-${ANALYSIS_ID}`],
      { revalidate: false, tags: ["comments", ANALYSIS_ID, "ws-1"] },
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

  it("keys the entry on the workspace, so the same analysis id cannot cross tenants", async () => {
    const comments = [makeComment(1)];

    await prCommentsService.getComments(
      stubDb(comments).db,
      ANALYSIS_ID,
      "018f0000-0000-7000-8000-0000000000e1",
    );
    await prCommentsService.getComments(
      stubDb(comments).db,
      ANALYSIS_ID,
      "018f0000-0000-7000-8000-0000000000e2",
    );

    expect(mocks.unstable_cache.mock.calls[0]?.[1]).toStrictEqual([
      `pr-comments-html-018f0000-0000-7000-8000-0000000000e1-${ANALYSIS_ID}`,
    ]);
    expect(mocks.unstable_cache.mock.calls[1]?.[1]).toStrictEqual([
      `pr-comments-html-018f0000-0000-7000-8000-0000000000e2-${ANALYSIS_ID}`,
    ]);
    expect(mocks.unstable_cache.mock.calls[0]?.[1]).not.toStrictEqual(
      mocks.unstable_cache.mock.calls[1]?.[1],
    );
  });

  it("does not cache an empty page", async () => {
    const { db } = stubDb([]);

    const result = await prCommentsService.getComments(db, ANALYSIS_ID, "ws-1");

    expect(mocks.unstable_cache).not.toHaveBeenCalled();
    expect(mocks.markdownToHtml).not.toHaveBeenCalled();
    expect(result.renderedComments).toStrictEqual([]);
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
