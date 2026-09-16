import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  appLogger: { debug: vi.fn(), error: vi.fn(), flush: vi.fn(), info: vi.fn(), warn: vi.fn() },
  enhance: vi.fn((db: unknown) => db),
  repoMapper: { toPaginatedList: vi.fn((items: unknown[], meta: unknown) => ({ items, meta })) },
  repoService: {
    buildWhereClause: vi.fn(),
    createRepo: vi.fn(),
    delete: vi.fn(),
    deleteAll: vi.fn(),
    deleteByOwner: vi.fn(),
    getByName: vi.fn(),
    getByOwner: vi.fn(),
    getSlim: vi.fn(),
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
vi.mock("./repo.service", () => ({ repoService: mocks.repoService }));
vi.mock("./repo.mapper", () => ({ repoMapper: mocks.repoMapper }));

import { createCallerFactory } from "@/server/core/trpc/init";

import { repoRouter } from "./repo.router";

const UUID = "7f9c0c52-6f0d-4f6b-9c5e-3d4e5f6a7b8c";
const REPO_URL = "https://github.com/acme/repo";
const DATE = new Date("2026-01-01T00:00:00.000Z");

// Full PublicRepoSchema-shaped row (as returned by repoMapper.toPublic).
function createRepoFixture(overrides: Record<string, unknown> = {}) {
  return {
    createdAt: DATE,
    defaultBranch: "main",
    description: null,
    forks: 0,
    githubCreatedAt: DATE,
    githubId: 123,
    id: UUID,
    language: "TypeScript",
    license: null,
    name: "repo",
    openIssues: 0,
    owner: "acme",
    ownerAvatarUrl: null,
    publicId: UUID,
    pushedAt: DATE,
    size: 10,
    stars: 4,
    status: "NEW",
    topics: [],
    updatedAt: DATE,
    url: REPO_URL,
    visibility: "PUBLIC",
    ...overrides,
  };
}

function createRepoItemFixture(overrides: Record<string, unknown> = {}) {
  return {
    ...createRepoFixture(),
    analyses: [
      {
        complexityScore: 5,
        createdAt: DATE,
        onboardingScore: 6,
        score: 7,
        securityScore: 8,
        status: "COMPLETED",
        techDebtScore: 9,
      },
    ],
    complexityScore: 5,
    healthScore: 7,
    languageColor: "#3178c6",
    lastAnalysisDate: DATE,
    onboardingScore: 6,
    securityScore: 8,
    techDebtScore: 9,
    ...overrides,
  };
}

const createCaller = createCallerFactory(repoRouter);

// withZenStack overwrites ctx.db with enhance(ctx.prisma); the identity mock
// makes effective db === prisma, so the repo mocks and service db arg are prisma.
function makeCtx() {
  const repo = { count: vi.fn(), findMany: vi.fn() };
  const prisma = { repo };
  const ctx = {
    db: prisma,
    prisma,
    redis: null,
    req: {},
    requestInfo: {},
    session: { user: { id: "4" } },
  };
  return { caller: createCaller(ctx as never), prisma, repo };
}

describe("repoRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("adds the repository and returns it with NEW status", async () => {
      mocks.repoService.createRepo.mockResolvedValue(createRepoFixture());
      const { caller, prisma } = makeCtx();
      const result = await caller.create({ url: REPO_URL });
      expect(mocks.repoService.createRepo).toHaveBeenCalledWith(prisma, 4, REPO_URL);
      expect(result).toMatchObject({
        message: "Repository added",
        repo: expect.objectContaining({
          id: UUID,
          name: "repo",
          owner: "acme",
          status: "NEW",
          url: REPO_URL,
        }),
        success: true,
      });
    });
  });

  describe("delete", () => {
    it("passes through the service result", async () => {
      mocks.repoService.delete.mockResolvedValue({ message: "Deleted", success: true });
      const { caller, prisma } = makeCtx();
      const result = await caller.delete({ id: UUID });
      expect(result).toEqual({ message: "Deleted", success: true });
      expect(mocks.repoService.delete).toHaveBeenCalledWith(prisma, UUID);
    });
  });

  describe("deleteAll", () => {
    it("passes through the service result", async () => {
      mocks.repoService.deleteAll.mockResolvedValue({ message: "Deleted all", success: true });
      const { caller, prisma } = makeCtx();
      const result = await caller.deleteAll({});
      expect(result).toEqual({ message: "Deleted all", success: true });
      expect(mocks.repoService.deleteAll).toHaveBeenCalledWith(prisma);
    });
  });

  describe("deleteByOwner", () => {
    it("passes through the service result", async () => {
      mocks.repoService.deleteByOwner.mockResolvedValue({
        count: 1,
        message: "Deleted 1",
        success: true,
      });
      const { caller, prisma } = makeCtx();
      const result = await caller.deleteByOwner({ owner: "acme" });
      expect(result).toEqual({ count: 1, message: "Deleted 1", success: true });
      expect(mocks.repoService.deleteByOwner).toHaveBeenCalledWith(prisma, "acme");
    });
  });

  describe("getAll", () => {
    it("builds a paginated list with real metadata using filter defaults", async () => {
      mocks.repoService.buildWhereClause.mockReturnValue({});
      const items = [createRepoItemFixture(), createRepoItemFixture({ name: "other" })];
      const { caller, repo } = makeCtx();
      repo.findMany.mockResolvedValue(items);
      repo.count.mockResolvedValueOnce(10).mockResolvedValueOnce(2);
      const result = await caller.getAll({});
      // RepoFilterSchema defaults: limit 10, sortBy "updatedAt", sortOrder "desc", cursor undefined.
      expect(repo.findMany).toHaveBeenCalledWith({
        include: {
          analyses: { orderBy: { createdAt: "desc" }, select: expect.any(Object), take: 1 },
        },
        orderBy: { updatedAt: "desc" },
        skip: 0,
        take: 10,
        where: {},
      });
      expect(repo.count).toHaveBeenNthCalledWith(1, { where: {} });
      expect(repo.count).toHaveBeenNthCalledWith(2, { where: {} });
      expect(mocks.repoMapper.toPaginatedList).toHaveBeenCalledWith(items, expect.any(Object));
      expect(result.items).toHaveLength(2);
      expect(result.meta).toMatchObject({
        currentPage: 1,
        filteredCount: 2,
        pageSize: 10,
        totalCount: 10,
        totalPages: 1,
      });
    });

    it("uses a case-insensitive owner filter for the total count", async () => {
      mocks.repoService.buildWhereClause.mockReturnValue({});
      const { caller, repo } = makeCtx();
      repo.findMany.mockResolvedValue([createRepoItemFixture()]);
      repo.count.mockResolvedValueOnce(10).mockResolvedValueOnce(1);
      const filters = {
        owner: "acme",
        search: undefined,
        status: undefined,
        visibility: undefined,
      };
      const ownerWhere = { owner: { equals: "acme", mode: "insensitive" } };
      await caller.getAll({ owner: "acme" });
      expect(mocks.repoService.buildWhereClause).toHaveBeenCalledWith(filters);
      expect(repo.count).toHaveBeenNthCalledWith(1, { where: ownerWhere });
      expect(repo.count).toHaveBeenNthCalledWith(2, { where: {} });
    });

    it("applies cursor pagination to skip and take", async () => {
      mocks.repoService.buildWhereClause.mockReturnValue({});
      const { caller, repo } = makeCtx();
      repo.findMany.mockResolvedValue([createRepoItemFixture()]);
      repo.count.mockResolvedValue(10);
      await caller.getAll({ cursor: 2, limit: 10 });
      expect(repo.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10 }));
    });
  });

  describe("getByName", () => {
    it("rejects an empty name with BAD_REQUEST", async () => {
      const { caller } = makeCtx();
      await expect(caller.getByName({ name: "", owner: "x" })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      expect(mocks.repoService.getByName).not.toHaveBeenCalled();
    });
  });
});
