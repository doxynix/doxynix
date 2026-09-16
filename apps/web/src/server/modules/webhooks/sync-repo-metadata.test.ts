import { Visibility } from "@doxynix/shared";
import type { Repository } from "@octokit/webhooks-types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  appLogger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  prisma: { repo: { updateMany: vi.fn() } },
}));

vi.mock("@/server/core/app-logger", () => ({ appLogger: mocks.appLogger }));
vi.mock("@/server/core/db", () => ({ prisma: mocks.prisma }));

import { syncRepoMetadata } from "./sync-repo-metadata";

function makeRepository(overrides: Partial<Repository> = {}): Repository {
  return {
    archived: false,
    created_at: "2020-01-01T00:00:00Z",
    default_branch: "main",
    description: "A test repo",
    disabled: false,
    fork: false,
    forks: 0,
    forks_count: 0,
    full_name: "owner/repo",
    git_url: "git://github.com/owner/repo.git",
    has_discussions: false,
    has_downloads: true,
    has_issues: true,
    has_pages: false,
    has_projects: true,
    has_wiki: true,
    homepage: null,
    html_url: "https://github.com/owner/repo",
    id: 456,
    is_template: false,
    language: "TypeScript",
    license: {
      key: "mit",
      name: "MIT License",
      node_id: "n",
      spdx_id: "MIT",
      url: "https://api.github.com/licenses/mit",
    },
    master_branch: null,
    name: "repo",
    node_id: "n",
    open_issues: 0,
    open_issues_count: 0,
    owner: {
      avatar_url: "https://a/avatar.png",
      email: null,
      events_url: "",
      followers_url: "",
      following_url: "",
      gists_url: "",
      gravatar_id: null,
      html_url: "",
      id: 7,
      login: "owner",
      name: "Owner",
      node_id: "",
      organizations_url: "",
      received_events_url: "",
      repos_url: "",
      site_admin: false,
      starred_url: "",
      subscriptions_url: "",
      type: "User",
      url: "",
    },
    private: false,
    pushed_at: "2026-01-01T00:00:00Z",
    size: 1024,
    stargazers: 5,
    stargazers_count: 5,
    topics: ["typescript", "monorepo"],
    updated_at: "2026-01-01T00:00:00Z",
    url: "https://github.com/owner/repo",
    visibility: "public",
    watchers: 5,
    watchers_count: 5,
    ...overrides,
  } as unknown as Repository;
}

function getCall() {
  return vi.mocked(mocks.prisma.repo.updateMany).mock.calls[0]![0];
}

describe("syncRepoMetadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.repo.updateMany.mockResolvedValue({ count: 1 });
  });

  it("публичный репозиторий → updateMany с корректными данными", async () => {
    await syncRepoMetadata(makeRepository());

    const call = getCall();
    expect(call.where).toEqual({ githubId: 456 });
    expect(call.data.visibility).toBe(Visibility.PUBLIC);
    expect(call.data.defaultBranch).toBe("main");
    expect(call.data.license).toBe("MIT");
    expect(call.data.owner).toBe("owner");
    expect(call.data.topics).toEqual(["typescript", "monorepo"]);
    expect(mocks.appLogger.debug).toHaveBeenCalledWith(
      expect.objectContaining({
        githubId: 456,
        msg: "repo_metadata_opportunistically_synced",
      }),
    );
  });

  it("приватный репозиторий → visibility PRIVATE", async () => {
    await syncRepoMetadata(makeRepository({ private: true, visibility: "private" }));

    expect(getCall().data.visibility).toBe(Visibility.PRIVATE);
  });

  it("visibility 'internal' + private true → PRIVATE", async () => {
    await syncRepoMetadata(makeRepository({ private: true, visibility: "internal" }));

    expect(getCall().data.visibility).toBe(Visibility.PRIVATE);
  });

  it("license spdx_id 'NOASSERTION' → fallback на license.name", async () => {
    await syncRepoMetadata(
      makeRepository({
        license: {
          key: "custom",
          name: "Custom License",
          node_id: "n",
          spdx_id: "NOASSERTION",
          url: "",
        },
      }),
    );

    expect(getCall().data.license).toBe("Custom License");
  });

  it("license отсутствует → license null", async () => {
    await syncRepoMetadata(makeRepository({ license: null }));

    expect(getCall().data.license).toBeNull();
  });

  it("pushed_at числовое → Date из epoch seconds", async () => {
    await syncRepoMetadata(makeRepository({ pushed_at: 1_767_225_600 }));

    expect(getCall().data.pushedAt).toEqual(new Date(1_767_225_600 * 1000));
  });

  it("pushed_at null → pushedAt undefined", async () => {
    await syncRepoMetadata(makeRepository({ pushed_at: null }));

    expect(getCall().data.pushedAt).toBeUndefined();
  });

  it("description длиннее 1000 символов → обрезается до 1000", async () => {
    const longDesc = "a".repeat(1500);
    await syncRepoMetadata(makeRepository({ description: longDesc }));

    expect(getCall().data.description).toBe("a".repeat(1000));
  });

  it("updateMany count === 0 → debug не вызывается", async () => {
    mocks.prisma.repo.updateMany.mockResolvedValue({ count: 0 });

    await syncRepoMetadata(makeRepository());

    expect(mocks.appLogger.debug).not.toHaveBeenCalled();
  });

  it("updateMany выбрасывает ошибку → функция резолвится, логирует ошибку", async () => {
    mocks.prisma.repo.updateMany.mockRejectedValue(new Error("db down"));

    await expect(syncRepoMetadata(makeRepository())).resolves.toBeUndefined();

    expect(mocks.appLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "db down",
        githubId: 456,
        msg: "failed_to_sync_repo_metadata",
      }),
    );
  });
});
