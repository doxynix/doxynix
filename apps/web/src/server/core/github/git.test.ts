import fs from "node:fs/promises";

import type { Repo } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { taskLogger } from "@/server/modules/analysis/logic/task-logger";

import { prisma } from "../db";
import { cloneRepository, getAnalysisContext } from "./git";
import { parseGitUrl } from "./git-url";
import { GitHubAuthRequiredError, resolveClientContext } from "./github-provider";

vi.mock("node:fs/promises", () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    rm: vi.fn().mockResolvedValue(undefined),
  },
}));

const mockGit = {
  clone: vi.fn().mockResolvedValue(undefined),
  cwd: vi.fn().mockResolvedValue(undefined),
};

vi.mock("simple-git", () => ({
  default: vi.fn(() => mockGit),
}));

vi.mock("@/server/modules/analysis/logic/task-logger", () => ({
  taskLogger: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("../db", () => ({
  prisma: {
    analysis: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("./git-url", () => ({
  parseGitUrl: vi.fn((_url: string) => ({
    full_name: "doxynix/test-repo",
    resource: "github.com",
  })),
}));

vi.mock("./github-api", () => ({
  executeWithFallback: vi.fn(async (_prisma, _userId, octokit, _type, callback) => {
    return callback(octokit);
  }),
}));

vi.mock("./github-provider", () => {
  class MockGitHubAuthRequiredError extends Error {
    constructor() {
      super("Authentication required");
      this.name = "GitHubAuthRequiredError";
    }
  }

  return {
    GitHubAuthRequiredError: MockGitHubAuthRequiredError,
    resolveClientContext: vi.fn(),
  };
});

describe("server/core/github/git", () => {
  const mockRepo = {
    analyses: [],
    defaultBranch: "main",
    id: 1,
    name: "test-repo",
    owner: "doxynix",
    url: "https://github.com/doxynix/test-repo",
    visibility: "PUBLIC",
  } as unknown as Repo;

  const mockAnalysis = {
    id: 10,
    publicId: "analysis-xyz",
    repo: mockRepo,
  };

  const createMockOctokit = (sha = "commit-sha-123", token: string | null = "ghs_mock_token") => ({
    auth: vi.fn(async (options?: { type?: string }) => {
      if (options?.type === "installation") {
        return { token };
      }
      return { token };
    }),
    rest: {
      git: {
        getRef: vi.fn().mockResolvedValue({
          data: { object: { sha } },
        }),
      },
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getAnalysisContext", () => {
    it("should throw if analysis is not found in database", async () => {
      vi.mocked(prisma.analysis.findUnique).mockResolvedValue(null);

      await expect(getAnalysisContext("missing-id", 123)).rejects.toThrow("Analysis not found");
      expect(taskLogger.error).toHaveBeenCalledWith("GitHub: Analysis record not found");
    });

    it("should catch GitHubAuthRequiredError and throw friendly private repo message", async () => {
      vi.mocked(prisma.analysis.findUnique).mockResolvedValue(mockAnalysis as never);
      vi.mocked(resolveClientContext).mockRejectedValue(new GitHubAuthRequiredError());

      await expect(getAnalysisContext("analysis-xyz", 123)).rejects.toThrow(
        "This is a private repository. Please install Doxynix App or connect GitHub.",
      );
      expect(taskLogger.error).toHaveBeenCalledWith(
        "GitHub: Authentication required for this repository",
      );
    });

    it("should rethrow unexpected errors from resolveClientContext", async () => {
      vi.mocked(prisma.analysis.findUnique).mockResolvedValue(mockAnalysis as never);
      vi.mocked(resolveClientContext).mockRejectedValue(new Error("Network connection lost"));

      await expect(getAnalysisContext("analysis-xyz", 123)).rejects.toThrow(
        "Network connection lost",
      );
    });

    it("should throw for private repository accessed with 'app' client type", async () => {
      const privateRepo = { ...mockRepo, visibility: "PRIVATE" } as unknown as Repo;
      vi.mocked(prisma.analysis.findUnique).mockResolvedValue({
        ...mockAnalysis,
        repo: privateRepo,
      } as never);

      vi.mocked(resolveClientContext).mockResolvedValue({
        hasUserToken: false,
        octokit: createMockOctokit() as never,
        type: "app",
      });

      await expect(getAnalysisContext("analysis-xyz", 123)).rejects.toThrow(
        "This is a private repository. Please install Doxynix App or connect GitHub.",
      );
    });

    it("should throw for private repository accessed with 'public' client type", async () => {
      const privateRepo = { ...mockRepo, visibility: "PRIVATE" } as unknown as Repo;
      vi.mocked(prisma.analysis.findUnique).mockResolvedValue({
        ...mockAnalysis,
        repo: privateRepo,
      } as never);

      vi.mocked(resolveClientContext).mockResolvedValue({
        hasUserToken: false,
        octokit: createMockOctokit() as never,
        type: "public",
      });

      await expect(getAnalysisContext("analysis-xyz", 123)).rejects.toThrow(
        "This is a private repository. Please install Doxynix App or connect GitHub.",
      );
    });

    it("should throw error when token cannot be resolved for private repository", async () => {
      const privateRepo = { ...mockRepo, visibility: "PRIVATE" } as unknown as Repo;
      vi.mocked(prisma.analysis.findUnique).mockResolvedValue({
        ...mockAnalysis,
        repo: privateRepo,
      } as never);

      const octokitNoToken = {
        auth: vi.fn().mockRejectedValue(new Error("No token")),
        rest: {
          git: {
            getRef: vi.fn().mockResolvedValue({ data: { object: { sha: "sha-123" } } }),
          },
        },
      };

      vi.mocked(resolveClientContext).mockResolvedValue({
        githubInstallationId: 1,
        hasUserToken: false,
        octokit: octokitNoToken as never,
        type: "installation",
      });

      await expect(getAnalysisContext("analysis-xyz", 123)).rejects.toThrow(
        "Unable to resolve GitHub token for private repository.",
      );
      expect(taskLogger.error).toHaveBeenCalledWith(
        "GitHub: Unable to resolve token for private repository",
      );
    });

    it("should return cached context (repo: null) when forceRefresh is false and commit SHA matches last analysis", async () => {
      const repoWithLastAnalysis = {
        ...mockRepo,
        analyses: [{ commitSha: "sha-cached-123", status: "DONE" }],
      } as unknown as Repo;

      vi.mocked(prisma.analysis.findUnique).mockResolvedValue({
        ...mockAnalysis,
        repo: repoWithLastAnalysis,
      } as never);

      const mockOctokit = createMockOctokit("sha-cached-123", "token-123");
      vi.mocked(resolveClientContext).mockResolvedValue({
        githubInstallationId: 1,
        hasUserToken: false,
        octokit: mockOctokit as never,
        type: "installation",
      });

      const result = await getAnalysisContext("analysis-xyz", 123, false);

      expect(result).toEqual({
        currentSha: "sha-cached-123",
        repo: null,
        token: "token-123",
      });
      expect(taskLogger.info).toHaveBeenCalledWith(
        "GitHub: No new commits detected, using cached results",
      );
    });

    it("should return full context when forceRefresh is false but commit SHA has changed", async () => {
      const repoWithLastAnalysis = {
        ...mockRepo,
        analyses: [{ commitSha: "sha-old-123", status: "DONE" }],
      } as unknown as Repo;

      vi.mocked(prisma.analysis.findUnique).mockResolvedValue({
        ...mockAnalysis,
        repo: repoWithLastAnalysis,
      } as never);

      const mockOctokit = createMockOctokit("sha-new-456", "token-123");
      vi.mocked(resolveClientContext).mockResolvedValue({
        githubInstallationId: 1,
        hasUserToken: false,
        octokit: mockOctokit as never,
        type: "installation",
      });

      const result = await getAnalysisContext("analysis-xyz", 123, false);

      expect(result).toEqual({
        currentSha: "sha-new-456",
        repo: repoWithLastAnalysis,
        token: "token-123",
      });
      expect(taskLogger.success).toHaveBeenCalledWith(
        "GitHub: Target commit identified as sha-new-456",
      );
    });

    it("should return full context when forceRefresh is true even if SHA matches", async () => {
      const repoWithLastAnalysis = {
        ...mockRepo,
        analyses: [{ commitSha: "sha-same-123", status: "DONE" }],
      } as unknown as Repo;

      vi.mocked(prisma.analysis.findUnique).mockResolvedValue({
        ...mockAnalysis,
        repo: repoWithLastAnalysis,
      } as never);

      const mockOctokit = createMockOctokit("sha-same-123", "token-123");
      vi.mocked(resolveClientContext).mockResolvedValue({
        githubInstallationId: 1,
        hasUserToken: false,
        octokit: mockOctokit as never,
        type: "installation",
      });

      const result = await getAnalysisContext("analysis-xyz", 123, true);

      expect(result.repo).toBe(repoWithLastAnalysis);
      expect(result.currentSha).toBe("sha-same-123");
    });

    it("should fallback to client.auth() without params when installation auth rejects", async () => {
      vi.mocked(prisma.analysis.findUnique).mockResolvedValue(mockAnalysis as never);

      const octokitWithFallbackAuth = {
        auth: vi.fn(async (options?: { type?: string }) => {
          if (options?.type === "installation") {
            throw new Error("Installation auth failed");
          }
          return { token: "oauth_fallback_token" };
        }),
        rest: {
          git: {
            getRef: vi.fn().mockResolvedValue({ data: { object: { sha: "sha-fallback" } } }),
          },
        },
      };

      vi.mocked(resolveClientContext).mockResolvedValue({
        hasUserToken: true,
        octokit: octokitWithFallbackAuth as never,
        type: "oauth",
      });

      const result = await getAnalysisContext("analysis-xyz", 123);

      expect(result.token).toBe("oauth_fallback_token");
      expect(result.currentSha).toBe("sha-fallback");
    });
  });

  describe("cloneRepository", () => {
    it("should prepare target folder, clone default branch without token and set cwd", async () => {
      const targetPath = "/tmp/workspaces/repo-1";

      await cloneRepository(mockRepo, null, targetPath);

      expect(fs.rm).toHaveBeenCalledWith(targetPath, { force: true, recursive: true });
      expect(fs.mkdir).toHaveBeenCalledWith(targetPath, { recursive: true });
      expect(parseGitUrl).toHaveBeenCalledWith(mockRepo.url);

      expect(mockGit.clone).toHaveBeenCalledWith(
        "https://github.com/doxynix/test-repo.git",
        targetPath,
        ["--filter=blob:none", "--single-branch", "--branch", "main", "--no-tags"],
      );
      expect(mockGit.cwd).toHaveBeenCalledWith(targetPath);
      expect(taskLogger.success).toHaveBeenCalledWith(
        "Git: Repository cloned to local worker storage",
      );
    });

    it("should clone selected branch when explicitly passed", async () => {
      const targetPath = "/tmp/workspaces/repo-2";

      await cloneRepository(mockRepo, undefined, targetPath, "feature/preview-mode");

      expect(mockGit.clone).toHaveBeenCalledWith(
        "https://github.com/doxynix/test-repo.git",
        targetPath,
        ["--filter=blob:none", "--single-branch", "--branch", "feature/preview-mode", "--no-tags"],
      );
    });

    it("should attach base64 Authorization header in git options when token is present", async () => {
      const targetPath = "/tmp/workspaces/repo-3";
      const token = "ghp_secretTokenValue123";
      const expectedBasicAuth = Buffer.from(`x-access-token:${token}`).toString("base64");

      await cloneRepository(mockRepo, token, targetPath);

      expect(mockGit.clone).toHaveBeenCalledWith(
        "https://github.com/doxynix/test-repo.git",
        targetPath,
        [
          "--filter=blob:none",
          "--single-branch",
          "--branch",
          "main",
          "--no-tags",
          "-c",
          `http.extraheader=Authorization: Basic ${expectedBasicAuth}`,
        ],
      );
    });

    it("should cleanup target folder, mask token in error message and rethrow when clone fails", async () => {
      const targetPath = "/tmp/workspaces/repo-fail";
      const token = "ghp_super_secret_token";
      const errorMsg = `fatal: Authentication failed for https://x-access-token:${token}@github.com/doxynix/test-repo.git`;

      mockGit.clone.mockRejectedValueOnce(new Error(errorMsg));

      await expect(cloneRepository(mockRepo, token, targetPath)).rejects.toThrow(
        "Failed to clone repository: fatal: Authentication failed for https://x-access-token:***@github.com/doxynix/test-repo.git",
      );

      expect(fs.rm).toHaveBeenCalledTimes(2);
      expect(taskLogger.error).toHaveBeenCalledWith(
        "Git: Clone failed. fatal: Authentication failed for https://x-access-token:***@github.com/doxynix/test-repo.git",
      );
    });

    it("should handle non-Error thrown objects during clone failure", async () => {
      const targetPath = "/tmp/workspaces/repo-fail-string";

      mockGit.clone.mockRejectedValueOnce("Simple git fatal error string");

      await expect(cloneRepository(mockRepo, null, targetPath)).rejects.toThrow(
        "Failed to clone repository: Simple git fatal error string",
      );

      expect(fs.rm).toHaveBeenCalledTimes(2);
      expect(taskLogger.error).toHaveBeenCalledWith(
        "Git: Clone failed. Simple git fatal error string",
      );
    });
  });
});
