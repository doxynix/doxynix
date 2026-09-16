import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DbClient, PrismaClientExtended } from "@/server/core/db";

const mocks = vi.hoisted(() => ({
  api: {
    getBranches: vi.fn(),
    getFileContent: vi.fn(),
    getRepoTree: vi.fn(),
    searchRepos: vi.fn(),
  },
  appLogger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  GitHubAuthRequiredError: class GitHubAuthRequiredError extends Error {},
  getFileScore: vi.fn((_p: string) => 10),
  isOctokitError: vi.fn(() => false),
}));

vi.mock("@/server/modules/analysis/engine/core/file-classifier", () => ({
  getFileScore: mocks.getFileScore,
}));
vi.mock("@/server/utils/handle-error", () => ({
  isOctokitError: mocks.isOctokitError,
}));
vi.mock("../app-logger", () => ({
  appLogger: mocks.appLogger,
}));
vi.mock("./github-api", () => ({
  getFileContent: mocks.api.getFileContent,
  getRepoBranches: mocks.api.getBranches,
  getRepoTree: mocks.api.getRepoTree,
  searchRepos: mocks.api.searchRepos,
}));
vi.mock("./github-provider", () => ({
  GitHubAuthRequiredError: mocks.GitHubAuthRequiredError,
}));

import { githubBrowseService } from "./github-browse.service";

const prisma = {} as PrismaClientExtended;

describe("githubBrowseService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getFileScore.mockImplementation((_p: string) => 10);
    mocks.isOctokitError.mockImplementation(() => false);
  });

  describe("getBranches", () => {
    it("returns branches from the GitHub API", async () => {
      mocks.api.getBranches.mockResolvedValue(["main", "dev"]);

      const result = githubBrowseService.getBranches(prisma, 1, "owner", "name");

      await expect(result).resolves.toEqual(["main", "dev"]);
      expect(mocks.api.getBranches).toHaveBeenCalledWith(prisma, 1, "owner", "name");
    });

    it("maps a 404 octokit error to NOT_FOUND", async () => {
      const err = { message: "x", status: 404 };
      mocks.isOctokitError.mockReturnValue(true);
      mocks.api.getBranches.mockRejectedValueOnce(err);

      const promise = githubBrowseService.getBranches(prisma, 1, "o", "n");

      await expect(promise).rejects.toBeInstanceOf(TRPCError);
      await expect(promise).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(promise).rejects.toThrow(/branch not found/);
    });

    it("maps a 403 octokit error to FORBIDDEN", async () => {
      const err = { message: "x", status: 403 };
      mocks.isOctokitError.mockReturnValue(true);
      mocks.api.getBranches.mockRejectedValueOnce(err);

      const promise = githubBrowseService.getBranches(prisma, 1, "o", "n");

      await expect(promise).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "GitHub denied access to repository branches.",
      });
    });

    it("maps GitHubAuthRequiredError to FORBIDDEN with the auth message", async () => {
      mocks.api.getBranches.mockRejectedValueOnce(new mocks.GitHubAuthRequiredError());

      const promise = githubBrowseService.getBranches(prisma, 1, "o", "n");

      await expect(promise).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(promise).rejects.toThrow(/Connect your GitHub account or install the app/);
    });
  });

  describe("getFileContent", () => {
    const repo = { defaultBranch: "main", name: "repo", owner: "owner" };

    function dbWithRepo(findUniqueResult: typeof repo | null): DbClient {
      return {
        repo: { findUnique: vi.fn().mockResolvedValue(findUniqueResult) },
      } as unknown as DbClient;
    }

    it("rejects NOT_FOUND when the repository does not exist", async () => {
      const db = dbWithRepo(null);

      const promise = githubBrowseService.getFileContent(db, prisma, 1, "repoId", "src/x.ts");

      await expect(promise).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "Repository not found",
      });
      expect(db.repo.findUnique).toHaveBeenCalledWith({
        where: { publicId: "repoId", userId: 1 },
      });
      expect(mocks.api.getFileContent).not.toHaveBeenCalled();
    });

    it("returns the file content using the repository default branch", async () => {
      const db = dbWithRepo(repo);
      mocks.api.getFileContent.mockResolvedValue({ content: "code", meta: { name: "x.ts" } });

      const result = await githubBrowseService.getFileContent(db, prisma, 1, "repoId", "src/x.ts");

      expect(result).toEqual({ content: "code", meta: { name: "x.ts" } });
      expect(mocks.api.getFileContent).toHaveBeenCalledWith(
        prisma,
        1,
        "owner",
        "repo",
        "src/x.ts",
        "main",
      );
    });

    it("passes the provided branch instead of the default branch", async () => {
      const db = dbWithRepo(repo);
      mocks.api.getFileContent.mockResolvedValue({ content: "code", meta: { name: "x.ts" } });

      await githubBrowseService.getFileContent(db, prisma, 1, "repoId", "src/x.ts", "feature");

      expect(mocks.api.getFileContent).toHaveBeenCalledWith(
        prisma,
        1,
        "owner",
        "repo",
        "src/x.ts",
        "feature",
      );
    });

    it("maps a generic error to INTERNAL_SERVER_ERROR and logs it", async () => {
      const db = dbWithRepo(repo);
      mocks.api.getFileContent.mockRejectedValueOnce(new Error("boom"));

      const promise = githubBrowseService.getFileContent(db, prisma, 1, "repoId", "src/x.ts");

      await expect(promise).rejects.toMatchObject({
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not fetch file content from GitHub.",
      });
      expect(mocks.appLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: "Failed to fetch file content from GitHub",
          path: "src/x.ts",
        }),
      );
    });

    it("maps a 404 octokit error to NOT_FOUND", async () => {
      const db = dbWithRepo(repo);
      const err = { message: "x", status: 404 };
      mocks.isOctokitError.mockReturnValue(true);
      mocks.api.getFileContent.mockRejectedValueOnce(err);

      const promise = githubBrowseService.getFileContent(db, prisma, 1, "repoId", "src/x.ts");

      await expect(promise).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(promise).rejects.toThrow(/File or branch not found/);
    });
  });

  describe("getRepoFiles", () => {
    it("maps tree entries to compact rows with a score flag", async () => {
      mocks.api.getRepoTree.mockResolvedValue([
        { path: "src/a.ts", sha: "abcdef123456", type: "blob" },
        { path: "docs", sha: "xyz", type: "tree" },
      ]);

      const rows = await githubBrowseService.getRepoFiles(prisma, 1, "owner", "name");

      expect(rows).toEqual([
        ["src/a.ts", 1, "abcdef1", 0],
        ["docs", 0, "xyz", 0],
      ]);
      expect(mocks.api.getRepoTree).toHaveBeenCalledWith(prisma, 1, "owner", "name", undefined);
    });

    it("flags files whose score is greater than 40", async () => {
      mocks.api.getRepoTree.mockResolvedValue([
        { path: "src/a.ts", sha: "abcdef123456", type: "blob" },
      ]);
      mocks.getFileScore.mockReturnValueOnce(50);

      const rows = await githubBrowseService.getRepoFiles(prisma, 1, "owner", "name");

      expect(rows).toEqual([["src/a.ts", 1, "abcdef1", 1]]);
      expect(mocks.getFileScore).toHaveBeenCalledWith("src/a.ts");
    });

    it("rethrows an unexpected tree error", async () => {
      const err = new Error("boom");
      mocks.api.getRepoTree.mockRejectedValueOnce(err);

      const promise = githubBrowseService.getRepoFiles(prisma, 1, "owner", "name");

      await expect(promise).rejects.toBe(err);
    });

    it("rejects INTERNAL_SERVER_ERROR when the tree is null", async () => {
      mocks.api.getRepoTree.mockResolvedValueOnce(null);

      const promise = githubBrowseService.getRepoFiles(prisma, 1, "owner", "name");

      await expect(promise).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
      await expect(promise).rejects.toThrow(/Could not fetch repository files/);
    });
  });

  describe("searchGithub", () => {
    it("returns repositories from the GitHub API", async () => {
      mocks.api.searchRepos.mockResolvedValue([{ fullName: "a/b" }]);

      const result = await githubBrowseService.searchGithub(prisma, 1, "query");

      expect(result).toEqual([{ fullName: "a/b" }]);
      expect(mocks.api.searchRepos).toHaveBeenCalledWith(prisma, 1, "query", 10);
    });

    it("maps GitHubAuthRequiredError to FORBIDDEN", async () => {
      mocks.api.searchRepos.mockRejectedValueOnce(new mocks.GitHubAuthRequiredError());

      const promise = githubBrowseService.searchGithub(prisma, 1, "query");

      await expect(promise).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(promise).rejects.toThrow(/search repositories/);
    });

    it("rethrows other errors unchanged", async () => {
      const err = new Error("boom");
      mocks.api.searchRepos.mockRejectedValueOnce(err);

      const promise = githubBrowseService.searchGithub(prisma, 1, "query");

      await expect(promise).rejects.toBe(err);
    });
  });
});
