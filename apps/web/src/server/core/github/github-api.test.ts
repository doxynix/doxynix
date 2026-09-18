import { Visibility } from "@doxynix/shared";
import type { Repo } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DbClient } from "../db";
import { calculateBusFactor, executeWithFallback, mapRepos } from "./github-api";
import type { OctokitInstance } from "./github-provider";

const mocks = vi.hoisted(() => ({
  appLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  GitHubAuthRequiredError: class GitHubAuthRequiredError extends Error {},
  getLanguageColor: vi.fn((lang: string | null) => (lang === "TypeScript" ? "#3178c6" : "#cccccc")),
  getPublicClient: vi.fn(),
  isOctokitError: vi.fn(() => false),
  resolveClientContext: vi.fn(),
  taskLogger: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warn: vi.fn() },
}));

vi.mock("@/server/utils/handle-error", () => ({ isOctokitError: mocks.isOctokitError }));

vi.mock("@/server/utils/language-metadata", () => ({
  getLanguageColor: mocks.getLanguageColor,
}));

vi.mock("../app-logger", () => ({ appLogger: mocks.appLogger }));

vi.mock("@/server/modules/analysis/logic/task-logger", () => ({
  taskLogger: mocks.taskLogger,
}));

vi.mock("./github-provider", () => ({
  GitHubAuthRequiredError: mocks.GitHubAuthRequiredError,
  getPublicClient: mocks.getPublicClient,
  resolveClientContext: mocks.resolveClientContext,
}));

const prismaMocks = { account: { findMany: vi.fn() } };
const prismaMock = prismaMocks as unknown as DbClient;

const createOctokitMock = (contributors: Array<{ contributions: number; login: string }>) => ({
  paginate: vi.fn().mockResolvedValue(contributors),
  rest: {
    repos: {
      listContributors: vi.fn(),
    },
  },
});

describe("github-api: Core Logic & Resilient Algorithms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isOctokitError.mockReturnValue(false);
  });

  describe("calculateBusFactor (50% rule algorithm)", () => {
    const makeRepo = (visibility: "PRIVATE" | "PUBLIC" = "PUBLIC"): Repo =>
      ({ id: 1, name: "repo", owner: "acme", visibility }) as Repo;

    it("calculates bus factor = 1 when single contributor owns >= 50% commits", async () => {
      const octokit = createOctokitMock([
        { contributions: 60, login: "lead" },
        { contributions: 40, login: "dev" },
      ]);

      mocks.resolveClientContext.mockResolvedValue({ octokit, type: "oauth" });

      const result = await calculateBusFactor(makeRepo(), 1, prismaMock);

      expect(result.busFactor).toBe(1);
      expect(result.rawContributors[0]?.login).toBe("lead");
    });

    it("calculates bus factor = 2 when two contributors are required to reach 50%", async () => {
      const octokit = createOctokitMock([
        { contributions: 30, login: "alice" },
        { contributions: 25, login: "bob" },
        { contributions: 25, login: "carol" },
        { contributions: 20, login: "dave" },
      ]);

      mocks.resolveClientContext.mockResolvedValue({ octokit, type: "oauth" });

      const result = await calculateBusFactor(makeRepo(), 1, prismaMock);

      expect(result.busFactor).toBe(2);
    });

    it("returns busFactor = 0 safely for repositories with no commits", async () => {
      const octokit = createOctokitMock([{ contributions: 0, login: "bot" }]);

      mocks.resolveClientContext.mockResolvedValue({ octokit, type: "oauth" });

      const result = await calculateBusFactor(makeRepo(), 1, prismaMock);

      expect(result.busFactor).toBe(0);
    });

    it("blocks unauthenticated access to private repositories", async () => {
      const octokit = createOctokitMock([]);

      mocks.resolveClientContext.mockResolvedValue({ octokit, type: "public" });

      await expect(calculateBusFactor(makeRepo("PRIVATE"), 1, prismaMock)).rejects.toBeInstanceOf(
        mocks.GitHubAuthRequiredError,
      );
    });
  });

  describe("mapRepos", () => {
    it("maps raw GitHub data, resolves language colors and sets Visibility enum", () => {
      const result = mapRepos([
        {
          description: "Desc",
          full_name: "acme/repo",
          language: "TypeScript",
          private: true,
          stargazers_count: 10,
          updated_at: "2026-01-01T00:00:00Z",
        } as any,
      ]);

      expect(result[0]).toEqual({
        description: "Desc",
        fullName: "acme/repo",
        language: "TypeScript",
        languageColor: "#3178c6",
        stars: 10,
        updatedAt: "2026-01-01T00:00:00Z",
        visibility: Visibility.PRIVATE,
      });
    });
  });

  describe("executeWithFallback (Token failover)", () => {
    it("recovers from 401/403 by iterating over secondary OAuth tokens", async () => {
      const fallbackClient = {} as OctokitInstance;

      mocks.isOctokitError.mockReturnValue(true);
      mocks.getPublicClient.mockReturnValue(fallbackClient);
      prismaMocks.account.findMany.mockResolvedValue([{ accessToken: "backup-token" }]);

      const op = vi
        .fn()
        .mockRejectedValueOnce(Object.assign(new Error("Auth expired"), { status: 401 }))
        .mockResolvedValueOnce("recovered-data");

      const result = await executeWithFallback(prismaMock, 1, {} as any, "installation", op);

      expect(result).toBe("recovered-data");
      expect(mocks.getPublicClient).toHaveBeenCalledWith("backup-token");
    });
  });
});
