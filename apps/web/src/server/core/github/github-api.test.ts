import { Visibility } from "@doxynix/shared";
import type { Repo } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DbClient } from "../db";
import { calculateBusFactor, executeWithFallback, mapRepos } from "./github-api";
import type { OctokitInstance } from "./github-provider";

// ── Hoisted mocks: defined before vi.mock calls ──────────────────────────────
const mocks = vi.hoisted(() => ({
  appLogger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  GitHubAuthRequiredError: class GitHubAuthRequiredError extends Error {},
  getInstallationClient: vi.fn(),
  getLanguageColor: vi.fn((lang: string | null) => (lang === "TypeScript" ? "#3178c6" : "#cccccc")),
  getPublicClient: vi.fn(),
  isOctokitError: vi.fn(() => false),
  resolveClientContext: vi.fn(),
  taskLogger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), success: vi.fn(), warn: vi.fn() },
}));

// ── Module mocks ─────────────────────────────────────────────────────────────
vi.mock("@/server/utils/handle-error", () => ({ isOctokitError: mocks.isOctokitError }));
vi.mock("@/server/utils/language-metadata", () => ({ getLanguageColor: mocks.getLanguageColor }));
vi.mock("../app-logger", () => ({ appLogger: mocks.appLogger }));
vi.mock("@/server/modules/analysis/logic/task-logger", () => ({ taskLogger: mocks.taskLogger }));
vi.mock("@/server/modules/analysis/engine/core/project-policy", async (importOriginal) => {
  const mod = await importOriginal<Record<string, unknown>>();
  return { ...mod, ProjectPolicy: { isIgnored: (p: string) => p.includes("node_modules") } };
});
vi.mock("./github-provider", () => ({
  GitHubAuthRequiredError: mocks.GitHubAuthRequiredError,
  getInstallationClient: mocks.getInstallationClient,
  getPublicClient: mocks.getPublicClient,
  resolveClientContext: mocks.resolveClientContext,
}));

// Minimal in-memory approximation of the DbClient used by the tested functions.
const prismaMocks = {
  account: { findMany: vi.fn() },
};
const prismaMock = prismaMocks as unknown as DbClient;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isOctokitError.mockReset().mockReturnValue(false);
});

// ── Helpers ──────────────────────────────────────────────────────────────────
type RepoResponse = Parameters<typeof mapRepos>[0][number];

function repoResponse(overrides: Record<string, unknown> = {}): RepoResponse {
  return {
    description: "A test repository",
    full_name: "acme/doxynix",
    language: "TypeScript",
    private: false,
    stargazers_count: 42,
    updated_at: "2024-01-15T10:00:00Z",
    ...overrides,
  } as unknown as RepoResponse;
}

function makeRepo(
  overrides: Partial<Pick<Repo, "id" | "name" | "owner" | "visibility">> = {},
): Repo {
  return {
    id: 1,
    name: "acme-app",
    owner: "acme",
    visibility: "PUBLIC",
    ...overrides,
  } as unknown as Repo;
}

function makeOctokit() {
  const paginate = vi.fn();
  return { paginate, rest: { repos: { listContributors: {} } } };
}

// ── mapRepos ─────────────────────────────────────────────────────────────────
describe("mapRepos", () => {
  it("maps a full repo object to RepoItemFields", () => {
    const result = mapRepos([repoResponse()]);

    expect(result).toEqual([
      {
        description: "A test repository",
        fullName: "acme/doxynix",
        language: "TypeScript",
        languageColor: "#3178c6",
        stars: 42,
        updatedAt: "2024-01-15T10:00:00Z",
        visibility: Visibility.PUBLIC,
      },
    ]);
    expect(mocks.getLanguageColor).toHaveBeenCalledWith("TypeScript");
  });

  it("maps private repos to PRIVATE visibility", () => {
    const result = mapRepos([repoResponse({ private: true })]);

    expect(result[0]?.visibility).toBe(Visibility.PRIVATE);
  });

  it("handles missing optional fields", () => {
    const result = mapRepos([
      repoResponse({ description: null, language: null, updated_at: undefined }),
    ]);

    expect(result[0]?.description).toBeNull();
    expect(result[0]?.language).toBeNull();
    expect(result[0]?.languageColor).toBe("#cccccc");
    expect(mocks.getLanguageColor).toHaveBeenCalledWith(null);
    expect(result[0]?.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result[0]?.visibility).toBe(Visibility.PUBLIC);
  });
});

// ── executeWithFallback ──────────────────────────────────────────────────────
describe("executeWithFallback", () => {
  it("returns the operation result on success without fallback", async () => {
    const operation = vi.fn(async () => "ok");

    const result = await executeWithFallback<string>(
      prismaMock,
      1,
      {} as unknown as OctokitInstance,
      "installation",
      operation,
    );

    expect(result).toBe("ok");
    expect(prismaMocks.account.findMany).not.toHaveBeenCalled();
    expect(mocks.getPublicClient).not.toHaveBeenCalled();
  });

  it("rethrows non-retryable errors without fallback", async () => {
    const error = Object.assign(new Error("rate limited"), { status: 429 });
    mocks.isOctokitError.mockReturnValueOnce(true);
    const operation = vi.fn(async (_client: OctokitInstance) => {
      throw error;
    });

    await expect(
      executeWithFallback<string>(
        prismaMock,
        1,
        {} as unknown as OctokitInstance,
        "installation",
        operation,
      ),
    ).rejects.toBe(error);
    expect(prismaMocks.account.findMany).not.toHaveBeenCalled();
    expect(mocks.getPublicClient).not.toHaveBeenCalled();
  });

  it("retries with an oauth fallback client on retryable errors", async () => {
    const fallbackClient = { paginate: vi.fn(), rest: {} } as unknown as OctokitInstance;
    mocks.isOctokitError.mockReturnValueOnce(true);
    mocks.getPublicClient.mockReturnValue(fallbackClient);
    prismaMocks.account.findMany.mockResolvedValue([{ accessToken: "tok1" }]);

    const operation = vi.fn(async (client: OctokitInstance) => {
      if (client === fallbackClient) {
        return "fallback-ok";
      }
      throw Object.assign(new Error("installation auth failed"), { status: 401 });
    });

    const result = await executeWithFallback<string>(
      prismaMock,
      1,
      {} as unknown as OctokitInstance,
      "installation",
      operation,
    );

    expect(result).toBe("fallback-ok");
    expect(mocks.getPublicClient).toHaveBeenCalledWith("tok1");
    expect(prismaMocks.account.findMany).toHaveBeenCalledTimes(1);
  });

  it("rethrows the original error when every oauth fallback fails", async () => {
    const originalError = Object.assign(new Error("forbidden"), { status: 403 });
    mocks.isOctokitError.mockReturnValueOnce(true);
    mocks.getPublicClient.mockReturnValue({});
    prismaMocks.account.findMany.mockResolvedValue([
      { accessToken: "tok1" },
      { accessToken: "tok2" },
    ]);

    const operation = vi.fn(async (_client: OctokitInstance) => {
      throw originalError;
    });

    await expect(
      executeWithFallback<string>(
        prismaMock,
        1,
        {} as unknown as OctokitInstance,
        "oauth",
        operation,
      ),
    ).rejects.toBe(originalError);

    expect(mocks.appLogger.error).toHaveBeenCalledTimes(2);
    expect(mocks.getPublicClient).toHaveBeenNthCalledWith(1, "tok1");
    expect(mocks.getPublicClient).toHaveBeenNthCalledWith(2, "tok2");
  });
});

// ── calculateBusFactor ───────────────────────────────────────────────────────
describe("calculateBusFactor", () => {
  it("rejects with GitHubAuthRequiredError for a private repo on an app client", async () => {
    const repo = makeRepo({ visibility: "PRIVATE" });
    const octokit = makeOctokit();
    mocks.resolveClientContext.mockResolvedValue({ octokit, type: "app" });

    await expect(calculateBusFactor(repo, 1, prismaMock)).rejects.toBeInstanceOf(
      mocks.GitHubAuthRequiredError,
    );

    expect(octokit.paginate).not.toHaveBeenCalled();
    expect(mocks.taskLogger.error).toHaveBeenCalledWith(
      "GitHub: Private repository access denied (missing installation)",
    );
  });

  it("returns busFactor 0 when contributors have no commits", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit();
    mocks.resolveClientContext.mockResolvedValue({ octokit, type: "oauth" });
    octokit.paginate.mockResolvedValue([{ contributions: 0, login: "a" }]);

    const result = await calculateBusFactor(repo, 1, prismaMock);

    expect(result).toEqual({ busFactor: 0, rawContributors: [{ contributions: 0, login: "a" }] });
    expect(mocks.taskLogger.warn).toHaveBeenCalledWith(
      "GitHub: No commit history found for this repository",
    );
  });

  it("computes bus factor with the 50% rule", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit();
    mocks.resolveClientContext.mockResolvedValue({ octokit, type: "oauth" });
    octokit.paginate.mockResolvedValue([
      { contributions: 60, login: "alice" },
      { contributions: 40, login: "bob" },
    ]);

    const result = await calculateBusFactor(repo, 1, prismaMock);

    expect(result.busFactor).toBe(1);
    expect(result.rawContributors).toEqual([
      { contributions: 60, login: "alice" },
      { contributions: 40, login: "bob" },
    ]);
  });

  it("returns busFactor 0 for retryable errors on public repos", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit();
    mocks.resolveClientContext.mockResolvedValue({ octokit, type: "oauth" });
    prismaMocks.account.findMany.mockResolvedValue([]);
    const error = Object.assign(new Error("auth failed"), { status: 401 });
    mocks.isOctokitError.mockReturnValueOnce(true);
    octokit.paginate.mockRejectedValue(error);

    const result = await calculateBusFactor(repo, 1, prismaMock);

    expect(result).toEqual({ busFactor: 0, rawContributors: [] });
    expect(mocks.taskLogger.warn).toHaveBeenCalledWith(
      "GitHub: Bus Factor calculation failed (likely due to API limits). Defaulting to 0.",
    );
    expect(mocks.appLogger.warn).toHaveBeenCalledWith(expect.objectContaining({ repoId: repo.id }));
  });

  it("rethrows non-retryable errors", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit();
    mocks.resolveClientContext.mockResolvedValue({ octokit, type: "oauth" });
    const error = Object.assign(new Error("server error"), { status: 500 });
    octokit.paginate.mockRejectedValue(error);

    await expect(calculateBusFactor(repo, 1, prismaMock)).rejects.toBe(error);
    expect(prismaMocks.account.findMany).not.toHaveBeenCalled();
  });
});
