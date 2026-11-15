import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  appLogger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  createManyAndReturn: vi.fn(),
  findManyPRAnalyses: vi.fn(),
  findManyRepos: vi.fn(),
  getStore: vi.fn((): unknown => ({})),
  publish: vi.fn().mockResolvedValue(undefined),
  revalidateTag: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidateTag: mocks.revalidateTag }));
vi.mock("@/server/core/app-logger", () => ({ appLogger: mocks.appLogger }));
vi.mock("@/server/core/db", () => ({
  prisma: {
    pullRequestAnalysis: { findMany: mocks.findManyPRAnalyses },
    pullRequestComment: { createManyAndReturn: mocks.createManyAndReturn },
    repo: { findMany: mocks.findManyRepos },
  },
}));
vi.mock("@/server/core/realtime", () => ({
  realtimeService: { user: () => ({ publish: mocks.publish }) },
}));
vi.mock("@/server/utils/request-context", () => ({
  requestContext: { getStore: mocks.getStore },
}));

import type { IssueCommentCreatedPayload } from "@/server/core/github/github-webhook.types";

import { handleIssueCommentEvent } from "./issue-comment-webhook-handler";

const ANALYSIS_ID = "018f0000-0000-7000-8000-0000000000aa";
const OTHER_ANALYSIS_ID = "018f0000-0000-7000-8000-0000000000ab";
const REPO_ID = "018f0000-0000-7000-8000-0000000000cc";

function makePayload(body = "please take a look"): IssueCommentCreatedPayload {
  return {
    action: "created",
    comment: { body, id: 991 },
    issue: { number: 7, title: "Bound the payload" },
    repository: {
      id: 4242,
      name: "doxynix",
      owner: { login: "ivan" },
    },
    sender: { avatar_url: "https://avatars.ivan", login: "ivan", type: "User" },
  } as unknown as IssueCommentCreatedPayload;
}

function stubDb(
  analyses: Array<{ id: string; repoId: string }>,
  inserted: Array<{ analysisId: string; id: string }>,
) {
  mocks.findManyRepos.mockResolvedValue([
    {
      createdByUserId: "018f0000-0000-7000-8000-0000000000dd",
      defaultBranch: "main",
      id: REPO_ID,
      workspaceId: "018f0000-0000-7000-8000-0000000000ee",
    },
  ]);
  mocks.findManyPRAnalyses.mockResolvedValue(analyses);
  mocks.createManyAndReturn.mockResolvedValue(inserted);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getStore.mockReturnValue({});
  mocks.publish.mockResolvedValue(undefined);
});

describe("handleIssueCommentEvent", () => {
  it("revalidates the analysis tag of the page the comment was mirrored into", async () => {
    stubDb([{ id: ANALYSIS_ID, repoId: REPO_ID }], [{ analysisId: ANALYSIS_ID, id: "c1" }]);

    const mention = await handleIssueCommentEvent(makePayload());

    expect(mocks.createManyAndReturn).toHaveBeenCalledTimes(1);
    expect(mocks.revalidateTag).toHaveBeenCalledTimes(1);
    expect(mocks.revalidateTag).toHaveBeenCalledWith(ANALYSIS_ID, { expire: 0 });
    expect(mocks.publish).toHaveBeenCalledTimes(1);
    expect(mention).toBeNull();
  });

  it("revalidates each distinct analysis id once", async () => {
    stubDb(
      [
        { id: ANALYSIS_ID, repoId: REPO_ID },
        { id: OTHER_ANALYSIS_ID, repoId: REPO_ID },
      ],
      [
        { analysisId: ANALYSIS_ID, id: "c1" },
        { analysisId: OTHER_ANALYSIS_ID, id: "c2" },
        { analysisId: OTHER_ANALYSIS_ID, id: "c3" },
      ],
    );

    await handleIssueCommentEvent(makePayload());

    expect(mocks.revalidateTag.mock.calls).toStrictEqual([
      [ANALYSIS_ID, { expire: 0 }],
      [OTHER_ANALYSIS_ID, { expire: 0 }],
    ]);
  });

  it("skips revalidation when there is no request scope to revalidate from", async () => {
    mocks.getStore.mockReturnValue(undefined);
    stubDb([{ id: ANALYSIS_ID, repoId: REPO_ID }], [{ analysisId: ANALYSIS_ID, id: "c1" }]);

    const mention = await handleIssueCommentEvent(makePayload());

    expect(mocks.createManyAndReturn).toHaveBeenCalledTimes(1);
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
    expect(mocks.publish).toHaveBeenCalledTimes(1);
    expect(mention).toBeNull();
  });

  it("still returns a mention reply for an @doxynix comment", async () => {
    stubDb([{ id: ANALYSIS_ID, repoId: REPO_ID }], [{ analysisId: ANALYSIS_ID, id: "c1" }]);

    const mention = await handleIssueCommentEvent(makePayload("@doxynix why is this big?"));

    expect(mention).toMatchObject({
      commentType: "issue",
      prNumber: 7,
      repoId: REPO_ID,
      repoName: "doxynix",
      workspaceId: "018f0000-0000-7000-8000-0000000000ee",
    });
  });

  it("does not touch caches when there is no analysis row to mirror into", async () => {
    stubDb([], []);

    const mention = await handleIssueCommentEvent(makePayload());

    expect(mention).toBeNull();
    expect(mocks.createManyAndReturn).not.toHaveBeenCalled();
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });
});
