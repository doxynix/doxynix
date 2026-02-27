import { Status, Visibility } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DbClient } from "@/server/db/db";
import { githubService } from "@/server/services/github.service";
import { repoService } from "@/server/services/repo.service";
import { handlePrismaError } from "@/server/utils/handle-prisma-error";

vi.mock("@/server/services/github.service", () => ({
  githubService: {
    getRepoInfo: vi.fn(),
    parseUrl: vi.fn(),
  },
}));

vi.mock("@/server/utils/handle-prisma-error", () => ({
  handlePrismaError: vi.fn(() => {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Mocked prisma handler error",
    });
  }),
}));

const db = {
  repo: {
    create: vi.fn(),
  },
};

const dbClient = db as unknown as DbClient;

type GitHubRepoInfo = Awaited<ReturnType<typeof githubService.getRepoInfo>>;

function createGitHubRepoInfo(overrides: Partial<GitHubRepoInfo> = {}): GitHubRepoInfo {
  const getValue = <K extends keyof GitHubRepoInfo>(
    key: K,
    fallback: GitHubRepoInfo[K]
  ): GitHubRepoInfo[K] => {
    return Object.prototype.hasOwnProperty.call(overrides, key)
      ? (overrides[key] as GitHubRepoInfo[K])
      : fallback;
  };

  return {
    created_at: getValue("created_at", "2024-01-10T10:00:00.000Z"),
    default_branch: getValue("default_branch", "main"),
    description: getValue("description", "Repository description"),
    forks_count: getValue("forks_count", 12),
    html_url: getValue("html_url", "https://github.com/owner/repo"),
    id: getValue("id", 123_456),
    language: getValue("language", "TypeScript"),
    license: getValue("license", {
      key: "",
      name: "MIT",
      node_id: "",
      spdx_id: null,
      url: null,
    }),
    name: getValue("name", "repo"),
    open_issues_count: getValue("open_issues_count", 3),
    owner: getValue("owner", {
      avatar_url: "https://avatar.example/image.png",
      events_url: "",
      followers_url: "",
      following_url: "",
      gists_url: "",
      gravatar_id: null,
      html_url: "",
      id: 0,
      login: "owner",
      node_id: "",
      organizations_url: "",
      received_events_url: "",
      repos_url: "",
      site_admin: false,
      starred_url: "",
      subscriptions_url: "",
      type: "",
      url: "",
    }),
    private: getValue("private", true),
    pushed_at: getValue("pushed_at", "2024-05-11T12:30:00.000Z"),
    size: getValue("size", 999),
    stargazers_count: getValue("stargazers_count", 44),
    topics: getValue("topics", ["fsd", "vitest"]),
  } as GitHubRepoInfo;
}

describe("repoService.buildWhereClause", () => {
  it("should return empty object when filters are not provided", () => {
    const filters = {};

    const where = repoService.buildWhereClause(filters);

    expect(where).toEqual({});
  });

  it("should build visibility and owner filters with case-insensitive owner lookup", () => {
    const filters = {
      owner: "TeSt-Owner",
      visibility: Visibility.PRIVATE,
    };

    const where = repoService.buildWhereClause(filters);

    expect(where).toEqual({
      owner: { equals: "TeSt-Owner", mode: "insensitive" },
      visibility: Visibility.PRIVATE,
    });
  });

  it("should build NEW status filter with OR branch for repos without analyses", () => {
    const filters = { status: Status.NEW };

    const where = repoService.buildWhereClause(filters);

    expect(where).toEqual({
      OR: [{ analyses: { none: {} } }, { analyses: { some: { status: Status.NEW } } }],
    });
  });

  it("should build non-NEW status filter with analyses.some", () => {
    const filters = { status: Status.DONE };

    const where = repoService.buildWhereClause(filters);

    expect(where).toEqual({
      analyses: { some: { status: Status.DONE } },
    });
  });

  it("should split search by spaces and build AND of OR conditions", () => {
    const filters = {
      search: "  react   query  ",
    };

    const where = repoService.buildWhereClause(filters);

    expect(where).toEqual({
      AND: [
        {
          OR: [
            { name: { contains: "react", mode: "insensitive" } },
            { owner: { contains: "react", mode: "insensitive" } },
            { description: { contains: "react", mode: "insensitive" } },
          ],
        },
        {
          OR: [
            { name: { contains: "query", mode: "insensitive" } },
            { owner: { contains: "query", mode: "insensitive" } },
            { description: { contains: "query", mode: "insensitive" } },
          ],
        },
      ],
    });
  });

  it("should combine all available filters into one where clause", () => {
    const filters = {
      owner: "owner",
      search: "repo",
      status: Status.FAILED,
      visibility: Visibility.PUBLIC,
    };

    const where = repoService.buildWhereClause(filters);

    expect(where).toEqual({
      analyses: { some: { status: Status.FAILED } },
      AND: [
        {
          OR: [
            { name: { contains: "repo", mode: "insensitive" } },
            { owner: { contains: "repo", mode: "insensitive" } },
            { description: { contains: "repo", mode: "insensitive" } },
          ],
        },
      ],
      owner: { equals: "owner", mode: "insensitive" },
      visibility: Visibility.PUBLIC,
    });
  });
});

describe("repoService.createRepo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should throw BAD_REQUEST when URL parsing fails", async () => {
    vi.mocked(githubService.parseUrl).mockImplementation(() => {
      throw new Error("Invalid URL");
    });

    const createPromise = repoService.createRepo(dbClient, 1, "wrong-format");

    await expect(createPromise).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it.each([
    {
      expectedCode: "UNAUTHORIZED",
      expectedMessage: "GitHub token expired",
      status: 401,
    },
    {
      expectedCode: "NOT_FOUND",
      expectedMessage: "Repository not found on GitHub",
      status: 404,
    },
    {
      expectedCode: "TOO_MANY_REQUESTS",
      expectedMessage: "GitHub API limit exceeded",
      status: 403,
    },
  ])(
    "should map GitHub status $status to TRPC error $expectedCode",
    async ({ expectedCode, expectedMessage, status }) => {
      vi.mocked(githubService.parseUrl).mockReturnValue({ name: "repo", owner: "owner" });
      vi.mocked(githubService.getRepoInfo).mockRejectedValue({
        message: "GitHub error",
        status,
      });

      const createPromise = repoService.createRepo(dbClient, 7, "owner/repo");

      await expect(createPromise).rejects.toMatchObject({
        code: expectedCode,
        message: expectedMessage,
      });
    }
  );

  it("should rethrow non-octokit errors from GitHub request", async () => {
    const unknownError = new Error("Network failure");
    vi.mocked(githubService.parseUrl).mockReturnValue({ name: "repo", owner: "owner" });
    vi.mocked(githubService.getRepoInfo).mockRejectedValue(unknownError);

    const createPromise = repoService.createRepo(dbClient, 5, "owner/repo");

    await expect(createPromise).rejects.toThrow("Network failure");
  });

  it("should create repository with mapped fields when GitHub returns full payload", async () => {
    const githubResponse = createGitHubRepoInfo();
    const createdRepo = { id: 11, name: "repo" };

    vi.mocked(githubService.parseUrl).mockReturnValue({ name: "repo", owner: "owner" });
    vi.mocked(githubService.getRepoInfo).mockResolvedValue(githubResponse);
    vi.mocked(db.repo.create).mockResolvedValue(createdRepo);

    const result = await repoService.createRepo(dbClient, 42, "owner/repo");

    expect(result).toEqual(createdRepo);
    expect(vi.mocked(db.repo.create)).toHaveBeenCalledWith({
      data: {
        defaultBranch: "main",
        description: "Repository description",
        forks: 12,
        githubCreatedAt: new Date("2024-01-10T10:00:00.000Z"),
        githubId: 123_456,
        language: "TypeScript",
        license: "MIT",
        name: "repo",
        openIssues: 3,
        owner: "owner",
        ownerAvatarUrl: "https://avatar.example/image.png",
        pushedAt: new Date("2024-05-11T12:30:00.000Z"),
        size: 999,
        stars: 44,
        topics: ["fsd", "vitest"],
        url: "https://github.com/owner/repo",
        userId: 42,
        visibility: Visibility.PRIVATE,
      },
    });
  });

  it("should fallback to empty topics and PUBLIC visibility when optional GitHub fields are missing", async () => {
    const githubResponse = createGitHubRepoInfo({
      description: null,
      language: null,
      license: null,
      private: false,
      topics: undefined,
    });

    vi.mocked(githubService.parseUrl).mockReturnValue({ name: "repo", owner: "owner" });
    vi.mocked(githubService.getRepoInfo).mockResolvedValue(githubResponse);
    vi.mocked(db.repo.create).mockResolvedValue({ id: 22 });

    await repoService.createRepo(dbClient, 1, "owner/repo");

    expect(vi.mocked(db.repo.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          topics: [],
          visibility: Visibility.PUBLIC,
        }),
      })
    );
  });

  it("should delegate prisma errors to handlePrismaError with proper map", async () => {
    const dbError = new Error("Unique failed");
    const mappedError = new TRPCError({
      code: "CONFLICT",
      message: "This repository is already added",
    });

    vi.mocked(githubService.parseUrl).mockReturnValue({ name: "repo", owner: "owner" });
    vi.mocked(githubService.getRepoInfo).mockResolvedValue(
      createGitHubRepoInfo({ private: false })
    );
    vi.mocked(db.repo.create).mockRejectedValue(dbError);
    vi.mocked(handlePrismaError).mockImplementation(() => {
      throw mappedError;
    });

    const createPromise = repoService.createRepo(dbClient, 7, "owner/repo");

    await expect(createPromise).rejects.toBe(mappedError);
    expect(handlePrismaError).toHaveBeenCalledWith(dbError, {
      defaultConflict: "You have already added this repository",
      uniqueConstraint: {
        githubId: "This repository is already added",
        url: "Repository with this URL already exists",
      },
    });
  });
});
