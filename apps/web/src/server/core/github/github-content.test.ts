import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DbClient, PrismaClientExtended } from "../db";
import { githubBrowseService } from "./github-content";

const mocks = vi.hoisted(() => ({
  appLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  GitHubAuthRequiredError: class GitHubAuthRequiredError extends Error {},
  getRawFileContent: vi.fn(),
  getRepoBranches: vi.fn(),
  getRepoTree: vi.fn(),
  isOctokitError: vi.fn(() => false),
  searchRepos: vi.fn(),
}));

vi.mock("@/server/core/api-error", async (importOriginal) => ({
  ...(await importOriginal()),
  isOctokitError: mocks.isOctokitError,
}));
vi.mock("../app-logger", () => ({ appLogger: mocks.appLogger }));
vi.mock("./github-api", () => ({
  getFileContent: mocks.getRawFileContent,
  getRepoBranches: mocks.getRepoBranches,
  getRepoTree: mocks.getRepoTree,
  searchRepos: mocks.searchRepos,
}));
vi.mock("./github-client", () => ({
  GitHubAuthRequiredError: mocks.GitHubAuthRequiredError,
}));

const USER_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d";
const WORKSPACE_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a6e";
const REPO_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a7f";
const PATH = "src/index.ts";

const prismaMock = {} as PrismaClientExtended;

function makeDb(repo: { defaultBranch: string; name: string; owner: string } | null) {
  return {
    repo: { findUnique: vi.fn().mockResolvedValue(repo) },
  } as unknown as DbClient;
}

describe("githubBrowseService.getFileContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isOctokitError.mockReturnValue(false);
  });

  it("returns content for a repository in the caller's workspace", async () => {
    const db = makeDb({ defaultBranch: "main", name: "demo", owner: "acme" });
    mocks.getRawFileContent.mockResolvedValue({
      content: "export const x = 1;",
      meta: { path: PATH },
    });

    const result = await githubBrowseService.getFileContent({
      db,
      path: PATH,
      prisma: prismaMock,
      repoId: REPO_ID,
      userId: USER_ID,
      workspaceId: WORKSPACE_ID,
    });

    expect(result.content).toBe("export const x = 1;");
    expect(db.repo.findUnique).toHaveBeenCalledWith({
      where: { id: REPO_ID, workspaceId: WORKSPACE_ID },
    });
    expect(mocks.getRawFileContent).toHaveBeenCalledWith(
      prismaMock,
      USER_ID,
      "acme",
      "demo",
      PATH,
      "main",
    );
  });

  it("throws NOT_FOUND when the repository belongs to another workspace", async () => {
    const db = makeDb(null);

    await expect(
      githubBrowseService.getFileContent({
        db,
        path: PATH,
        prisma: prismaMock,
        repoId: REPO_ID,
        userId: USER_ID,
        workspaceId: WORKSPACE_ID,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(db.repo.findUnique).toHaveBeenCalledWith({
      where: { id: REPO_ID, workspaceId: WORKSPACE_ID },
    });
    expect(mocks.getRawFileContent).not.toHaveBeenCalled();
  });

  it("uses the explicit branch instead of the repository default", async () => {
    const db = makeDb({ defaultBranch: "main", name: "demo", owner: "acme" });
    mocks.getRawFileContent.mockResolvedValue({ content: "x", meta: {} });

    await githubBrowseService.getFileContent({
      branch: "feature/dxnx-294",
      db,
      path: PATH,
      prisma: prismaMock,
      repoId: REPO_ID,
      userId: USER_ID,
      workspaceId: WORKSPACE_ID,
    });

    expect(mocks.getRawFileContent).toHaveBeenCalledWith(
      prismaMock,
      USER_ID,
      "acme",
      "demo",
      PATH,
      "feature/dxnx-294",
    );
  });
});
