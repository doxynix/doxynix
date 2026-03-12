import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DbClient } from "@/server/db/db";
import { githubService } from "@/server/services/github.service";

const parseGithubUrlMock = vi.hoisted(() => vi.fn());

const fileClassifierState = vi.hoisted(() => ({
  isIgnored: vi.fn<(path: string) => boolean>(),
}));

const loggerState = vi.hoisted(() => ({
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}));

const octokitState = vi.hoisted(() => ({
  auth: vi.fn(),
  constructorAuths: [] as any[],
  constructorOptions: [] as any[],
  getRepo: vi.fn(),
  getTree: vi.fn(),
  listForAuthenticatedUser: vi.fn(),
  listReposAccessibleToInstallation: vi.fn(),
  paginate: vi.fn(),
  searchRepos: vi.fn(),
}));

type ConstructorOptions = {
  auth: string;
  throttle?: {
    onRateLimit?: (
      retryAfter: number,
      options: { method: string; url: string },
      octokit: { log: { warn: (message: string) => void } },
      retryCount: number
    ) => boolean;
    onSecondaryRateLimit?: (
      retryAfter: number,
      options: { method: string; url: string },
      octokit: { log: { warn: (message: string) => void } }
    ) => boolean;
  };
};

vi.mock("@octokit/auth-app", () => ({
  createAppAuth: vi.fn(),
}));

vi.mock("@octokit/plugin-paginate-rest", () => ({
  paginateRest: vi.fn(),
}));

vi.mock("@octokit/plugin-retry", () => ({
  retry: vi.fn(),
}));

vi.mock("@octokit/plugin-throttling", () => ({
  throttling: vi.fn(),
}));

vi.mock("@octokit/rest", () => {
  class MockOctokit {
    static plugin() {
      return MockOctokit;
    }
    auth = octokitState.auth;

    log = {
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    };

    paginate = octokitState.paginate;

    rest = {
      apps: {
        listReposAccessibleToInstallation: octokitState.listReposAccessibleToInstallation,
      },
      git: {
        getTree: octokitState.getTree,
      },
      repos: {
        get: octokitState.getRepo,
        listForAuthenticatedUser: octokitState.listForAuthenticatedUser,
      },
      search: {
        repos: octokitState.searchRepos,
      },
    };

    constructor(options: ConstructorOptions) {
      octokitState.constructorAuths.push(options.auth);
      octokitState.constructorOptions.push(options);
    }
  }

  return {
    Octokit: MockOctokit,
  };
});

vi.mock("parse-github-url", () => ({
  default: parseGithubUrlMock,
}));

vi.mock("@/shared/constants/env.server", () => ({
  GITHUB_APP_ID: "123456",
  GITHUB_APP_PRIVATE_KEY: "mock-private-key",
  GITHUB_SYSTEM_INSTALLATION_ID: "999999",
}));

vi.mock("@/server/logger/logger", () => ({
  logger: loggerState,
}));

vi.mock("@/server/utils/file-classifier", () => ({
  FileClassifier: {
    isIgnored: fileClassifierState.isIgnored,
  },
}));

function createMockPrisma(accounts: any[] | any) {
  const normalizedAccounts =
    accounts == null ? [] : Array.isArray(accounts) ? accounts : [accounts];

  const findMany = vi.fn().mockResolvedValue(normalizedAccounts);
  const findFirst = vi.fn().mockResolvedValue(normalizedAccounts[0] ?? null);

  const prisma = {
    account: {
      findFirst,
      findMany,
    },
  } as unknown as DbClient;

  return {
    findFirst,
    findMany,
    prisma,
  };
}

describe("githubService", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    octokitState.constructorAuths.length = 0;
    octokitState.constructorOptions.length = 0;
    octokitState.auth.mockResolvedValue({ token: "mock-token" });
    octokitState.paginate.mockResolvedValue([]);
    fileClassifierState.isIgnored.mockReturnValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getClientContext", () => {
    it("should return installation context when githubInstallationId exists", async () => {
      const { prisma } = createMockPrisma([
        {
          githubInstallationId: 12345,
        },
      ]);

      const context = await githubService.getClientContext(prisma, 101);

      expect(context.type).toBe("installation");
      const options = octokitState.constructorOptions[0];
      expect(options.auth.installationId).toBe(12345);
      expect(options.auth.appId).toBe(123456);
    });

    it("should return oauth context when only access_token exists", async () => {
      const { prisma } = createMockPrisma([
        {
          access_token: "user-token",
        },
      ]);

      const context = await githubService.getClientContext(prisma, 101);
      expect(context.type).toBe("oauth");
    });

    it("should return app context (System Bot) when no account found", async () => {
      const { prisma } = createMockPrisma(null);
      const context = await githubService.getClientContext(prisma, 9);

      expect(context.type).toBe("app");
      const auth = octokitState.constructorAuths[0];
      expect(auth.installationId).toBe(999999);
    });

    it("should configure and execute throttle callbacks for rate limit handlers", async () => {
      const { prisma } = createMockPrisma({ access_token: "user-token" });
      const warn = vi.fn<(message: string) => void>();
      const octokit = {
        log: { warn },
      };

      await githubService.getClientContext(prisma, 1);

      const options = octokitState.constructorOptions[0];
      const onRateLimit = options.throttle?.onRateLimit;
      const onSecondaryRateLimit = options.throttle?.onSecondaryRateLimit;

      expect(onRateLimit?.(3, { method: "GET", url: "/repos" }, octokit, 0)).toBe(true);
      expect(onRateLimit?.(3, { method: "GET", url: "/repos" }, octokit, 2)).toBe(false);
      expect(onSecondaryRateLimit?.(2, { method: "POST", url: "/search" }, octokit)).toBe(true);
      expect(warn).toHaveBeenCalledTimes(3);
    });
  });

  describe("getMyRepos", () => {
    it("should return empty list when user has no accounts", async () => {
      const { prisma } = createMockPrisma([]);
      const repos = await githubService.getMyRepos(prisma, 10);
      expect(repos).toEqual([]);
      expect(octokitState.paginate).not.toHaveBeenCalled();
    });

    it("should fetch repos via paginate for oauth account", async () => {
      const { prisma } = createMockPrisma([{ access_token: "token" }]);
      octokitState.paginate.mockResolvedValue([
        { full_name: "owner/repo", private: false, stargazers_count: 5 },
      ]);

      const repos = await githubService.getMyRepos(prisma, 1);

      expect(octokitState.paginate).toHaveBeenCalledWith(
        octokitState.listForAuthenticatedUser,
        expect.objectContaining({ per_page: 100, visibility: "all" })
      );
      expect(repos[0].fullName).toBe("owner/repo");
    });

    it("should combine repos from multiple accounts and deduplicate", async () => {
      const { prisma } = createMockPrisma([
        { access_token: "token1" },
        { githubInstallationId: 123 },
      ]);

      octokitState.paginate.mockResolvedValue([{ full_name: "org/shared", private: false }]);

      const repos = await githubService.getMyRepos(prisma, 1);

      expect(repos).toHaveLength(1);
      expect(repos[0].fullName).toBe("org/shared");
    });

    it("should log error and continue if one account fails", async () => {
      const { prisma } = createMockPrisma([{ access_token: "token" }]);
      octokitState.paginate.mockRejectedValue(new Error("GitHub Down"));

      const repos = await githubService.getMyRepos(prisma, 4);

      expect(repos).toEqual([]);
      expect(loggerState.error).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: "Failed to fetch repos for one of the installations",
        })
      );
    });
  });

  describe("getRepoInfo", () => {
    it("should fetch repository info by owner and name", async () => {
      const { prisma } = createMockPrisma({ access_token: "token" });
      const repoPayload = { id: 77, name: "repo" };
      octokitState.getRepo.mockResolvedValue({ data: repoPayload });

      const data = await githubService.getRepoInfo(prisma, 1, "owner", "repo");

      expect(data).toEqual(repoPayload);
      expect(octokitState.getRepo).toHaveBeenCalledWith({ owner: "owner", repo: "repo" });
    });

    it("should propagate error when octokit throws", async () => {
      const { prisma } = createMockPrisma({ access_token: "token" });
      octokitState.getRepo.mockRejectedValue(new Error("Not found"));

      await expect(githubService.getRepoInfo(prisma, 1, "owner", "repo")).rejects.toThrow(
        "Not found"
      );
    });
  });

  describe("getRepoTree", () => {
    it("should load tree by default branch and filter ignored/non-blob nodes", async () => {
      const { prisma } = createMockPrisma({ access_token: "token" });
      fileClassifierState.isIgnored.mockImplementation((path) => path.includes("node_modules"));
      octokitState.getRepo.mockResolvedValue({ data: { default_branch: "main" } });
      octokitState.getTree.mockResolvedValue({
        data: {
          tree: [
            { path: "src/index.ts", sha: "sha-1", type: "blob" },
            { path: "node_modules/pkg.js", sha: "sha-2", type: "blob" },
            { path: "src", sha: "sha-3", type: "tree" },
            { path: null, sha: "sha-4", type: "blob" },
          ],
        },
      });

      const tree = await githubService.getRepoTree(prisma, 1, "owner", "repo");

      expect(octokitState.getTree).toHaveBeenCalledWith({
        owner: "owner",
        recursive: "1",
        repo: "repo",
        tree_sha: "main",
      });
      expect(tree).toEqual([{ path: "src/index.ts", sha: "sha-1", type: "blob" }]);
    });

    it("should use provided branch instead of repository default branch", async () => {
      const { prisma } = createMockPrisma({ access_token: "token" });
      octokitState.getRepo.mockResolvedValue({ data: { default_branch: "main" } });
      octokitState.getTree.mockResolvedValue({ data: { tree: [] } });

      await githubService.getRepoTree(prisma, 1, "owner", "repo", "release");

      expect(octokitState.getTree).toHaveBeenCalledWith({
        owner: "owner",
        recursive: "1",
        repo: "repo",
        tree_sha: "release",
      });
    });
  });

  describe("mapRepos", () => {
    it("should map GitHub repositories and fallback updatedAt to current time", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

      const mapped = githubService.mapRepos([
        {
          description: null,
          full_name: "owner/repo",
          language: null,
          private: true,
          stargazers_count: 0,
          updated_at: null,
        },
      ] as Parameters<typeof githubService.mapRepos>[0]);

      expect(mapped).toEqual([
        {
          description: null,
          fullName: "owner/repo",
          language: null,
          stars: 0,
          updatedAt: "2026-01-01T00:00:00.000Z",
          visibility: "PRIVATE",
        },
      ]);
    });
  });

  describe("parseUrl", () => {
    it("should throw when input is empty after trim", () => {
      expect(() => githubService.parseUrl("   ")).toThrow("Field cannot be empty");
      expect(parseGithubUrlMock).not.toHaveBeenCalled();
    });

    it("should throw when parser returns invalid owner or repo name", () => {
      parseGithubUrlMock.mockReturnValueOnce({ name: "repo", owner: "" });
      expect(() => githubService.parseUrl("owner/repo")).toThrow(
        "Invalid format. Enter 'owner/repo' or repository URL"
      );

      parseGithubUrlMock.mockReturnValueOnce({ name: "", owner: "owner" });
      expect(() => githubService.parseUrl("owner/repo")).toThrow(
        "Invalid format. Enter 'owner/repo' or repository URL"
      );
    });

    it("should return parsed owner and repo for valid input", () => {
      parseGithubUrlMock.mockReturnValue({ name: "repo", owner: "owner" });

      expect(githubService.parseUrl("https://github.com/owner/repo")).toEqual({
        name: "repo",
        owner: "owner",
      });
    });
  });

  describe("searchRepos", () => {
    it("should return empty array when query length is less than 2", async () => {
      const { prisma } = createMockPrisma({ access_token: "token" });

      await expect(githubService.searchRepos(prisma, 1, "a", 10)).resolves.toEqual([]);
      expect(octokitState.searchRepos).not.toHaveBeenCalled();
    });

    it("should return empty array when query length is greater than 256", async () => {
      const { prisma } = createMockPrisma({ access_token: "token" });
      const tooLongQuery = "a".repeat(257);

      await expect(githubService.searchRepos(prisma, 1, tooLongQuery, 10)).resolves.toEqual([]);
      expect(octokitState.searchRepos).not.toHaveBeenCalled();
    });

    it("should search repositories and map result using provided limit", async () => {
      const { prisma } = createMockPrisma({ access_token: "token" });
      octokitState.searchRepos.mockResolvedValue({
        data: {
          items: [
            {
              description: "desc",
              full_name: "owner/repo",
              language: "TypeScript",
              private: false,
              stargazers_count: 30,
              updated_at: "2025-02-10T00:00:00.000Z",
            },
          ],
        },
      });

      const result = await githubService.searchRepos(prisma, 1, "react", 5);

      expect(octokitState.searchRepos).toHaveBeenCalledWith({
        per_page: 5,
        q: "react",
      });
      expect(result).toEqual([
        {
          description: "desc",
          fullName: "owner/repo",
          language: "TypeScript",
          stars: 30,
          updatedAt: "2025-02-10T00:00:00.000Z",
          visibility: "PUBLIC",
        },
      ]);
    });

    it("should use default limit 10 when limit is undefined", async () => {
      const { prisma } = createMockPrisma({ access_token: "token" });
      octokitState.searchRepos.mockResolvedValue({ data: { items: [] } });

      await githubService.searchRepos(prisma, 1, "query", undefined);

      expect(octokitState.searchRepos).toHaveBeenCalledWith({
        per_page: 10,
        q: "query",
      });
    });

    it("should return empty array and log error when search throws", async () => {
      const { prisma } = createMockPrisma({ access_token: "token" });
      octokitState.searchRepos.mockRejectedValue(new Error("Search failed"));

      const result = await githubService.searchRepos(prisma, 1, "query", 10);

      expect(result).toEqual([]);
      expect(loggerState.error).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: "GitHub search error",
        })
      );
    });
  });
});
