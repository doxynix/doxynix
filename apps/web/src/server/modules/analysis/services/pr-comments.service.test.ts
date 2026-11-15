import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  markdownToHtml: vi.fn(async (input: { content: string }) => `<p>${input.content}</p>`),
  unstable_cache: vi.fn((fn: () => unknown) => fn),
}));

vi.mock("next/cache", () => ({ unstable_cache: mocks.unstable_cache }));
vi.mock("@/server/core/github/github-client", () => ({ getInstallationClient: vi.fn() }));
vi.mock("@/server/modules/analysis/services/markdown-to-html", () => ({
  markdownToHtml: mocks.markdownToHtml,
}));

import type { DbClient } from "@/server/core/db";

import { prCommentsService } from "./pr-comments.service";

const ANALYSIS_ID = "018f0000-0000-7000-8000-0000000000aa";

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

beforeEach(() => {
  vi.clearAllMocks();
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
      [`pr-comments-html-${ANALYSIS_ID}`],
      { revalidate: false, tags: ["comments", ANALYSIS_ID] },
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

  it("still issues one cache lookup for an empty page", async () => {
    const { db } = stubDb([]);

    const result = await prCommentsService.getComments(db, ANALYSIS_ID, "ws-1");

    expect(mocks.unstable_cache).toHaveBeenCalledTimes(1);
    expect(mocks.markdownToHtml).not.toHaveBeenCalled();
    expect(result.renderedComments).toStrictEqual([]);
  });
});
