import { describe, expect, it } from "vitest";

import { buildWorkspacePayload } from "./workspace-payload";

/**
 * Every leaf the projection reads gets a distinctive sentinel, so a field that is
 * accidentally dropped during refactoring shows up as a missing sentinel rather
 * than as an `undefined` that quietly matches.
 */
const SENTINEL = {
  architectureStyle: "modular-monolith",
  defaultNodeId: "group:apps",
  description: "A repo",
  forks: 12,
  language: "TypeScript",
  languageColor: "#3178c6",
  license: "MIT",
  name: "doxynix",
  openIssues: 3,
  owner: "acme",
  ownerAvatarUrl: "https://example.test/avatar.png",
  purpose: "Analyse repositories",
  pushedAt: "2026-02-01T00:00:00.000Z",
  repositoryKind: "monorepo",
  size: 4096,
  stack: ["bun", "next"],
  stars: 512,
  url: "https://example.test/acme/doxynix",
  visibility: "public",
} as const;

const analysisRef = {
  analysisId: "analysis-1",
  commitSha: "abc1234",
  createdAt: "2026-02-01T00:00:00.000Z",
} as const;

function payload(overrides: { overview?: Record<string, unknown>; structure?: object } = {}) {
  const overview = {
    docs: {
      availableCount: 4,
      availableTypes: ["README", "ARCHITECTURE"],
      hasSwagger: true,
      items: [
        {
          id: "doc-llm",
          source: "llm",
          status: "COMPLETED",
          type: "README",
          updatedAt: "2026-02-02T00:00:00.000Z",
          version: "abc1234",
        },
        {
          id: "doc-manual",
          source: "manual",
          status: "DRAFT",
          type: "ARCHITECTURE",
          updatedAt: "2026-02-03T00:00:00.000Z",
          version: "manual",
        },
      ],
    },
    languages: { TypeScript: 92 },
    maintenance: "active",
    mostComplexFiles: [{ complexity: 88, path: "src/server.ts" }],
    repo: {
      defaultBranch: "main",
      description: SENTINEL.description,
      forks: SENTINEL.forks,
      id: "repo-1",
      language: SENTINEL.language,
      languageColor: SENTINEL.languageColor,
      license: SENTINEL.license,
      name: SENTINEL.name,
      openIssues: SENTINEL.openIssues,
      owner: SENTINEL.owner,
      ownerAvatarUrl: SENTINEL.ownerAvatarUrl,
      pushedAt: SENTINEL.pushedAt,
      size: SENTINEL.size,
      stars: SENTINEL.stars,
      topics: ["ai", "code"],
      url: SENTINEL.url,
      visibility: SENTINEL.visibility,
    },
    scores: { complexity: 30, security: 80 },
    signals: { hasMonorepo: true },
    stats: { fileCount: 210, totalLoc: 30_000 },
    topRisks: [
      {
        id: "risk-1",
        severity: "HIGH",
        suggestedNextChange: "Split the router",
        summary: "Router is too large",
        title: "God object router",
      },
    ],
    ...overrides.overview,
  };

  const structure = {
    analysisRef,
    graph: {
      edges: [{ from: "group:apps", to: "group:web" }],
      groups: [{ id: "group:apps" }],
      nodes: [{ id: "group:apps", label: "Apps", path: "apps" }],
    },
    overview: {
      architectureStyle: SENTINEL.architectureStyle,
      primaryEntrypoints: ["apps/web/src/index.ts"],
      primaryModules: ["apps/web", "packages/shared"],
      purpose: SENTINEL.purpose,
      repositoryKind: SENTINEL.repositoryKind,
      stack: SENTINEL.stack,
    },
    selection: { defaultNodeId: SENTINEL.defaultNodeId },
    ...overrides.structure,
  };

  return buildWorkspacePayload({
    overview: overview as never,
    structure: structure as never,
  });
}

describe("buildWorkspacePayload", () => {
  it("carries the analysis reference through untouched", () => {
    expect(payload().analysisRef).toEqual(analysisRef);
  });

  it("projects every repository field", () => {
    expect(payload().repo).toEqual({
      defaultBranch: "main",
      description: SENTINEL.description,
      forks: SENTINEL.forks,
      id: "repo-1",
      language: SENTINEL.language,
      languageColor: SENTINEL.languageColor,
      license: SENTINEL.license,
      name: SENTINEL.name,
      openIssues: SENTINEL.openIssues,
      owner: SENTINEL.owner,
      ownerAvatarUrl: SENTINEL.ownerAvatarUrl,
      pushedAt: SENTINEL.pushedAt,
      size: SENTINEL.size,
      stars: SENTINEL.stars,
      topics: ["ai", "code"],
      url: SENTINEL.url,
      visibility: SENTINEL.visibility,
    });
  });

  it("summarizes the docs without dropping the counts", () => {
    const { docs } = payload();

    expect(docs.availableCount).toBe(4);
    expect(docs.availableTypes).toEqual(["README", "ARCHITECTURE"]);
    expect(docs.hasSwagger).toBe(true);
  });

  it("keeps an llm doc source", () => {
    expect(payload().docs.items[0]?.source).toBe("llm");
  });

  it("narrows any non-llm doc source to null", () => {
    expect(payload().docs.items[1]?.source).toBeNull();
  });

  it("projects each doc item", () => {
    expect(payload().docs.items[0]).toEqual({
      id: "doc-llm",
      source: "llm",
      status: "COMPLETED",
      type: "README",
      updatedAt: "2026-02-02T00:00:00.000Z",
      version: "abc1234",
    });
  });

  it("projects the navigation block from the structure map", () => {
    expect(payload().navigation).toEqual({
      defaultNodeId: SENTINEL.defaultNodeId,
      keyZones: [{ id: "group:apps", label: "Apps", path: "apps" }],
      primaryEntrypoints: ["apps/web/src/index.ts"],
      primaryModules: ["apps/web", "packages/shared"],
    });
  });

  it("merges the structure summary with the overview maintenance status", () => {
    expect(payload().summary).toEqual({
      architectureStyle: SENTINEL.architectureStyle,
      maintenance: "active",
      purpose: SENTINEL.purpose,
      repositoryKind: SENTINEL.repositoryKind,
      stack: SENTINEL.stack,
    });
  });

  it("passes the secondary block through by reference", () => {
    const { secondary } = payload();

    expect(secondary).toEqual({
      languages: { TypeScript: 92 },
      scores: { complexity: 30, security: 80 },
      signals: { hasMonorepo: true },
      stats: { fileCount: 210, totalLoc: 30_000 },
    });
  });

  it("passes the most complex files through", () => {
    expect(payload().mostComplexFiles).toEqual([{ complexity: 88, path: "src/server.ts" }]);
  });

  it("projects every top risk field", () => {
    expect(payload().topRisks).toEqual([
      {
        id: "risk-1",
        severity: "HIGH",
        suggestedNextChange: "Split the router",
        summary: "Router is too large",
        title: "God object router",
      },
    ]);
  });

  it("handles a repository with no risks", () => {
    expect(payload({ overview: { topRisks: [] } }).topRisks).toEqual([]);
  });

  it("handles a repository with no documents", () => {
    const result = payload({
      overview: { docs: { availableCount: 0, availableTypes: [], hasSwagger: false, items: [] } },
    });

    expect(result.docs.items).toEqual([]);
    expect(result.docs.availableCount).toBe(0);
  });
});
