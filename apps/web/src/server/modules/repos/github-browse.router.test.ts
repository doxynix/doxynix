import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  appLogger: {
    debug: vi.fn(),
    error: vi.fn(),
    flush: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
  enhance: vi.fn((db: unknown) => db),
  githubBrowseService: {
    getBranches: vi.fn(),
    getFileContent: vi.fn(),
    getRepoFiles: vi.fn(),
    searchGithub: vi.fn(),
  },
}));

vi.mock("@/server/core/app-logger", () => ({ appLogger: mocks.appLogger }));
vi.mock("@zenstackhq/runtime", () => ({ enhance: mocks.enhance }));
vi.mock("@/server/utils/request-context", () => ({
  buildRequestStore: vi.fn((o: unknown) => ({ ...(o as object), requestId: "req-1" })),
  requestContext: {
    getStore: vi.fn(() => null),
    run: vi.fn((_s: unknown, fn: () => unknown) => fn()),
  },
  resolveRequestId: vi.fn(() => "req-1"),
}));
vi.mock("@/shared/config/env.flags", () => ({ IS_PROD: false }));
vi.mock("@/server/core/github/github-browse.service", () => ({
  githubBrowseService: mocks.githubBrowseService,
}));

import { createCallerFactory } from "@/server/core/trpc/init";

import { githubBrowseRouter } from "./github-browse.router";

const REPO_ID = "7f9c0c52-6f0d-4f6b-9c5e-3d4e5f6a7b8c";

const createCaller = createCallerFactory(githubBrowseRouter);

function makeCtx() {
  const prisma = {};
  const ctx = {
    db: {},
    prisma,
    redis: null,
    req: {},
    requestInfo: {},
    session: { user: { id: "4" } },
  };
  return { caller: createCaller(ctx as never), prisma };
}

describe("githubBrowseRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getBranches returns branches from the service", async () => {
    mocks.githubBrowseService.getBranches.mockResolvedValue(["main", "dev"]);
    const { caller, prisma } = makeCtx();

    await expect(caller.getBranches({ name: "repo", owner: "acme" })).resolves.toEqual([
      "main",
      "dev",
    ]);
    expect(mocks.githubBrowseService.getBranches).toHaveBeenCalledWith(prisma, 4, "acme", "repo");
  });

  it("getFileContent passes branch through when provided", async () => {
    mocks.githubBrowseService.getFileContent.mockResolvedValue({
      content: "# Hi",
      path: "README.md",
    });
    const { caller, prisma } = makeCtx();

    // Default branch omitted → undefined.
    await caller.getFileContent({ path: "README.md", repoId: REPO_ID });
    expect(mocks.githubBrowseService.getFileContent).toHaveBeenNthCalledWith(
      1,
      prisma,
      prisma,
      4,
      REPO_ID,
      "README.md",
      undefined,
    );

    // Branch explicitly provided.
    await caller.getFileContent({ branch: "dev", path: "README.md", repoId: REPO_ID });
    expect(mocks.githubBrowseService.getFileContent).toHaveBeenNthCalledWith(
      2,
      prisma,
      prisma,
      4,
      REPO_ID,
      "README.md",
      "dev",
    );
  });

  it("getFileContent rejects an invalid repoId", async () => {
    const { caller } = makeCtx();

    await expect(
      caller.getFileContent({ path: "README.md", repoId: "nope" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.githubBrowseService.getFileContent).not.toHaveBeenCalled();
  });

  it("getRepoFiles lists files via the service", async () => {
    mocks.githubBrowseService.getRepoFiles.mockResolvedValue([
      { name: "README.md", path: "README.md", type: "blob" },
    ]);
    const { caller, prisma } = makeCtx();

    const result = await caller.getRepoFiles({ name: "repo", owner: "acme" });
    expect(result).toHaveLength(1);
    expect(mocks.githubBrowseService.getRepoFiles).toHaveBeenCalledWith(
      prisma,
      4,
      "acme",
      "repo",
      undefined,
    );
  });

  it("searchGithub forwards the query to the service", async () => {
    mocks.githubBrowseService.searchGithub.mockResolvedValue([{ full_name: "acme/repo", id: 1 }]);
    const { caller, prisma } = makeCtx();

    const result = await caller.searchGithub({ query: "test" });
    expect(result).toHaveLength(1);
    expect(mocks.githubBrowseService.searchGithub).toHaveBeenCalledWith(prisma, 4, "test");
  });
});
