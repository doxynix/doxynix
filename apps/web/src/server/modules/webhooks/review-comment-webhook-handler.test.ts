import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findManyRepos: vi.fn() }));

vi.mock("@/server/core/db", () => ({ prisma: { repo: { findMany: mocks.findManyRepos } } }));

import type { PullRequestReviewCommentPayload } from "@/server/core/github/github-webhook.types";

import { handleReviewCommentEvent } from "./review-comment-webhook-handler";

const REPO_ID = "018f0000-0000-7000-8000-0000000000cc";

function makePayload(body = "@doxynix why is this big?"): PullRequestReviewCommentPayload {
  return {
    action: "created",
    comment: { body, id: 991 },
    pull_request: { number: 7, title: "Bound the payload" },
    repository: { id: 4242, name: "doxynix", owner: { login: "ivan" } },
    sender: { avatar_url: "https://avatars.ivan", login: "ivan", type: "User" },
  } as unknown as PullRequestReviewCommentPayload;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findManyRepos.mockResolvedValue([
    {
      createdByUserId: "018f0000-0000-7000-8000-0000000000dd",
      defaultBranch: "main",
      id: REPO_ID,
      workspaceId: "018f0000-0000-7000-8000-0000000000ee",
    },
  ]);
});

describe("handleReviewCommentEvent", () => {
  it("selects only the columns the mention reply reads", async () => {
    await handleReviewCommentEvent(makePayload());

    expect(mocks.findManyRepos).toHaveBeenCalledWith({
      select: {
        createdByUserId: true,
        defaultBranch: true,
        id: true,
        workspaceId: true,
      },
      where: { githubId: 4242 },
    });
  });

  it("builds one reply per repo that mirrors the webhook", async () => {
    await expect(handleReviewCommentEvent(makePayload())).resolves.toStrictEqual([
      {
        branch: "main",
        commentBody: "@doxynix why is this big?",
        commentId: 991,
        commentType: "review",
        owner: "ivan",
        prNumber: 7,
        repoId: REPO_ID,
        repoName: "doxynix",
        userId: "018f0000-0000-7000-8000-0000000000dd",
        workspaceId: "018f0000-0000-7000-8000-0000000000ee",
      },
    ]);
  });

  it("ignores a comment without a mention", async () => {
    await expect(handleReviewCommentEvent(makePayload("nice"))).resolves.toStrictEqual([]);
    expect(mocks.findManyRepos).not.toHaveBeenCalled();
  });
});
