import type { PushEvent } from "@octokit/webhooks-types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  appLogger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  prisma: { repo: { findFirst: vi.fn() } },
}));

vi.mock("@/server/core/app-logger", () => ({ appLogger: mocks.appLogger }));
vi.mock("@/server/core/db", () => ({ prisma: mocks.prisma }));

import { handlePushEvent } from "./push-webhook-handler";

function makePushEvent(overrides: Partial<PushEvent> = {}): PushEvent {
  return {
    after: "sha-after",
    before: "sha-before",
    commits: [
      {
        added: [],
        author: { email: "a@b.c", name: "Alice", username: "alice" },
        committer: { email: "a@b.c", name: "Alice", username: "alice" },
        distinct: true,
        id: "c1",
        message: "commit",
        modified: [],
        removed: [],
        timestamp: "2026-01-01T00:00:00Z",
        url: "https://github.com/owner/repo/commit/c1",
      },
    ],
    ref: "refs/heads/main",
    repository: {
      default_branch: "main",
      full_name: "owner/repo",
      id: 123,
      name: "repo",
      owner: { avatar_url: null, email: null, id: 1, login: "owner", name: "Owner", type: "User" },
      private: false,
    },
    sender: {
      avatar_url: "x",
      events_url: "x",
      followers_url: "x",
      following_url: "x",
      gists_url: "x",
      gravatar_id: null,
      html_url: "x",
      id: 1,
      login: "owner",
      node_id: "n",
      organizations_url: "x",
      received_events_url: "x",
      repos_url: "x",
      site_admin: false,
      starred_url: "x",
      subscriptions_url: "x",
      type: "User",
      url: "x",
    },
    ...overrides,
  } as PushEvent;
}

describe("handlePushEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves without querying the repo when the branch is not the default", async () => {
    await expect(
      handlePushEvent(makePushEvent({ ref: "refs/heads/feature/x" })),
    ).resolves.toBeUndefined();

    expect(mocks.prisma.repo.findFirst).not.toHaveBeenCalled();
  });

  it("resolves without querying the repo when the default branch has zero commits", async () => {
    await expect(handlePushEvent(makePushEvent({ commits: [] }))).resolves.toBeUndefined();

    expect(mocks.prisma.repo.findFirst).not.toHaveBeenCalled();
  });

  it("resolves undefined when the repo is not found", async () => {
    mocks.prisma.repo.findFirst.mockResolvedValue(null);

    await expect(handlePushEvent(makePushEvent())).resolves.toBeUndefined();

    expect(mocks.prisma.repo.findFirst).toHaveBeenCalledWith({ where: { githubId: 123 } });
  });

  it("resolves without error when the repo is found", async () => {
    mocks.prisma.repo.findFirst.mockResolvedValue({ id: 1 });

    await expect(handlePushEvent(makePushEvent())).resolves.toBeUndefined();

    expect(mocks.appLogger.info).toHaveBeenCalledTimes(1);
    expect(mocks.appLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ msg: "push_webhook_received_default_branch" }),
    );
  });

  it("logs and re-throws when findFirst throws", async () => {
    mocks.prisma.repo.findFirst.mockRejectedValue(new Error("db down"));

    await expect(handlePushEvent(makePushEvent())).rejects.toThrow("db down");

    expect(mocks.appLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ msg: "push_webhook_error" }),
    );
  });
});
