import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DbClient } from "@/server/shared/infrastructure/db";
import * as githubApi from "@/server/shared/infrastructure/github/github-api";
import * as githubProvider from "@/server/shared/infrastructure/github/github-provider";
import { githubTokenService } from "@/server/shared/infrastructure/github/github-token.service";

const githubService = {
  ...githubApi,
  ...githubProvider,
};

const gitUrlParseMock = vi.hoisted(() => vi.fn());

const projectPolicyState = vi.hoisted(() => ({
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
  auth: any | string;
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
      octokit: { log: { warn: (message: string) => void } },
      retryCount: number
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

vi.mock("git-url-parse", () => ({
  default: gitUrlParseMock,
}));

vi.mock("@/shared/constants/env.server", () => ({
  APP_VERSION: "1.23.45",
  // secretlint-disable-next-line
  DATABASE_URL: "postgresql://mock:mock@localhost:5432/db",
  GITHUB_APP_ID: "123456",
  GITHUB_APP_PRIVATE_KEY: "mock-private-key",
  GITHUB_SYSTEM_INSTALLATION_ID: "999999",
}));

vi.mock("@/server/shared/infrastructure/logger", () => ({
  logger: loggerState,
}));

vi.mock("@/server/shared/engine/core/project-policy", () => ({
  ProjectPolicy: {
    isIgnored: projectPolicyState.isIgnored,
  },
}));

vi.mock("@/server/shared/infrastructure/github/github-token.service", () => ({
  githubTokenService: {
    getValidToken: vi.fn(),
  },
}));

function createMockPrisma(accounts: any | any[]) {
  const normalizedAccounts =
    accounts == null ? [] : Array.isArray(accounts) ? accounts : [accounts];

  const oauthAccounts = normalizedAccounts.filter((account) => account?.access_token != null);
  const installations = normalizedAccounts
    .filter((account) => account?.githubInstallationId != null)
    .map((account) => ({ id: account.githubInstallationId }));

  const accountFindMany = vi.fn().mockResolvedValue(oauthAccounts);
  const accountFindFirst = vi.fn().mockResolvedValue(oauthAccounts[0] ?? null);

  const installationFindMany = vi.fn().mockResolvedValue(installations);
  const installationFindFirst = vi.fn().mockResolvedValue(installations[0] ?? null);

  const prisma = {
    account: {
      findFirst: accountFindFirst,
      findMany: accountFindMany,
    },
    githubInstallation: {
      findFirst: installationFindFirst,
      findMany: installationFindMany,
    },
  } as unknown as DbClient;

  return {
    findFirst: accountFindFirst,
    findMany: accountFindMany,
    prisma,
  };
}

describe("githubService", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    octokitState.constructorAuths.length = 0;
    vi.mocked(githubTokenService.getValidToken).mockResolvedValue("mock-token");
    octokitState.constructorOptions.length = 0;
    octokitState.auth.mockResolvedValue({ token: "mock-token" });
    octokitState.paginate.mockResolvedValue([]);
    projectPolicyState.isIgnored.mockReturnValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getClientContext", () => {
    it("should return installation context when githubInstallationId exists", async () => {
      const { prisma } = createMockPrisma([
        {
          githubInstallationId: 12_345,
        },
      ]);

      vi.mocked(githubTokenService.getValidToken).mockResolvedValue(null);

      const context = await githubService.getClientContext(prisma, 101);

      expect(context.type).toBe("installation");
      const options = octokitState.constructorOptions[0];
      expect(options.auth.installationId).toBe(12_345);
      expect(options.auth.appId).toBe(123_456);
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

    it("should throw when no GitHub authorization is available", async () => {
      const { prisma } = createMockPrisma(null);
      vi.mocked(githubTokenService.getValidToken).mockResolvedValue(null);
      await expect(githubService.getClientContext(prisma, 9)).rejects.toThrow(
        "No valid GitHub authorization found"
      );
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
      expect(onSecondaryRateLimit?.(2, { method: "POST", url: "/search" }, octokit, 0)).toBe(true);
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
      expect(repos[0]?.fullName).toBe("owner/repo");
    });

    it("should combine repos from multiple accounts and deduplicate", async () => {
      const { prisma } = createMockPrisma([
        { access_token: "token1" },
        { githubInstallationId: 123 },
      ]);

      octokitState.paginate.mockResolvedValue([{ full_name: "org/shared", private: false }]);

      const repos = await githubService.getMyRepos(prisma, 1);

      expect(repos).toHaveLength(1);
      expect(repos[0]?.fullName).toBe("org/shared");
    });

    it("should log error and continue if one account fails", async () => {
      const { prisma } = createMockPrisma([{ access_token: "token" }]);
      octokitState.paginate.mockRejectedValue(new Error("GitHub Down"));

      const repos = await githubService.getMyRepos(prisma, 4);

      expect(repos).toEqual([]);
      expect(loggerState.error).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: "Failed OAuth fetch",
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
  });

  describe("getRepoTree", () => {
    it("should load tree by default branch and filter ignored/non-blob nodes", async () => {
      const { prisma } = createMockPrisma({ access_token: "token" });
      projectPolicyState.isIgnored.mockImplementation((path) => path.includes("node_modules"));
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
          languageColor: "#cccccc",
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
      expect(gitUrlParseMock).not.toHaveBeenCalled();
    });

    it("should throw when parser throws error", () => {
      gitUrlParseMock.mockImplementationOnce(() => {
        throw new Error("Invalid format");
      });
      expect(() => githubService.parseUrl("invalid")).toThrow(
        "Invalid format. Enter 'owner/repo' or repository URL"
      );
    });

    it("should return parsed owner and repo for valid input", () => {
      gitUrlParseMock.mockReturnValue({ name: "repo", owner: "owner" });

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
              languageColor: "#3178c6",
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
          languageColor: "#3178c6",
          stars: 30,
          updatedAt: "2025-02-10T00:00:00.000Z",
          visibility: "PUBLIC",
        },
      ]);
    });

    it("should use default limit 10 when limit is undefined", async () => {
      const { prisma } = createMockPrisma({ access_token: "token" });
      octokitState.searchRepos.mockResolvedValue({ data: { items: [] } });

      await githubService.searchRepos(prisma, 1, "query", 10);

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
