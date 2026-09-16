import { Status } from "@doxynix/shared";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/utils/language-metadata", () => ({
  getLanguageColor: vi.fn((lang: string | null) => (lang === "TypeScript" ? "#3178c6" : "#cccccc")),
}));

import type { PaginationMeta } from "@doxynix/shared";

import { getLanguageColor } from "@/server/utils/language-metadata";

import type { RepoWithAnalyses } from "./repo.mapper";
import { repoMapper } from "./repo.mapper";

function makeRepoWithAnalyses(overrides?: Partial<RepoWithAnalyses>): RepoWithAnalyses {
  return {
    analyses: [
      {
        complexityScore: 78,
        createdAt: new Date("2025-01-10"),
        onboardingScore: 85,
        score: 92,
        securityScore: 88,
        status: "DONE" as const,
        techDebtScore: 30,
      },
    ],
    createdAt: new Date("2025-01-01"),
    defaultBranch: "main",
    description: "A test repo",
    forks: 7,
    githubCreatedAt: new Date("2024-01-01"),
    githubId: 12_345,
    id: 1,
    language: "TypeScript",
    license: "MIT",
    name: "test-repo",
    openIssues: 3,
    owner: "test-owner",
    ownerAvatarUrl: "https://avatars.githubusercontent.com/u/1",
    publicId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    pushedAt: new Date("2025-01-15"),
    size: 1024,
    stars: 42,
    topics: ["test"],
    updatedAt: new Date("2025-01-15"),
    url: "https://github.com/test-owner/test-repo",
    userId: 1,
    visibility: "PUBLIC" as const,
    ...overrides,
  };
}

const meta: PaginationMeta = {
  currentPage: 1,
  filteredCount: 25,
  pageSize: 10,
  totalCount: 25,
  totalPages: 3,
};

describe("repoMapper.toPublic", () => {
  it("maps analysis fields and derives id/languageColor", () => {
    const repo = makeRepoWithAnalyses();
    const result = repoMapper.toPublic(repo);

    expect(result.complexityScore).toBe(78);
    expect(result.healthScore).toBe(92);
    expect(result.lastAnalysisDate).toEqual(new Date("2025-01-10"));
    expect(result.onboardingScore).toBe(85);
    expect(result.securityScore).toBe(88);
    expect(result.techDebtScore).toBe(30);
    expect(result.status).toBe("DONE");
    expect(result.id).toBe(repo.publicId);
    expect(result.languageColor).toBe("#3178c6");
    expect(getLanguageColor).toHaveBeenCalledWith("TypeScript");
  });

  it("returns null scores and Status.NEW when analyses is empty", () => {
    const repo = makeRepoWithAnalyses({ analyses: [] });
    const result = repoMapper.toPublic(repo);

    expect(result.complexityScore).toBeNull();
    expect(result.healthScore).toBeNull();
    expect(result.lastAnalysisDate).toBeNull();
    expect(result.onboardingScore).toBeNull();
    expect(result.securityScore).toBeNull();
    expect(result.techDebtScore).toBeNull();
    expect(result.status).toBe(Status.NEW);
  });

  it("maps null scores from analysis as null", () => {
    const repo = makeRepoWithAnalyses({
      analyses: [
        {
          complexityScore: null,
          createdAt: new Date("2025-02-01"),
          onboardingScore: null,
          score: null,
          securityScore: null,
          status: "PENDING" as const,
          techDebtScore: null,
        },
      ],
    });
    const result = repoMapper.toPublic(repo);

    expect(result.complexityScore).toBeNull();
    expect(result.healthScore).toBeNull();
    expect(result.securityScore).toBeNull();
    expect(result.techDebtScore).toBeNull();
    expect(result.onboardingScore).toBeNull();
    expect(result.status).toBe("PENDING");
  });
});

describe("repoMapper.toPaginatedList", () => {
  it("maps items via toPublic and passes meta through", () => {
    const repos = [makeRepoWithAnalyses(), makeRepoWithAnalyses()];
    const result = repoMapper.toPaginatedList(repos, meta);

    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.id).toBe(repos[0]?.publicId);
    expect(result.items[1]?.id).toBe(repos[1]?.publicId);
    expect(result.meta).toBe(meta);
  });

  it("returns empty items when given an empty array", () => {
    const result = repoMapper.toPaginatedList([], meta);

    expect(result.items).toEqual([]);
    expect(result.meta).toBe(meta);
  });
});
