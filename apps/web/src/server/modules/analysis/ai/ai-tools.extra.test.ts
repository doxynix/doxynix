import { describe, expect, it, vi } from "vitest";
import type { z } from "zod";

// ---------------------------------------------------------------------------
// Hoisted mocks — declared BEFORE source imports
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  apiForUser: vi.fn(),
  appLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  CodeOptimizer: {
    cleanForTool: vi.fn(async (c: string) => "clean:" + c),
    optimize: vi.fn(async (c: string) => "optimized:" + c),
  },
  githubBrowseService: {
    getFileContent: vi.fn(),
    getRepoFiles: vi.fn(),
  },
  prisma: {
    document: { findFirst: vi.fn() },
    repo: { findUnique: vi.fn() },
  },
  tool: vi.fn((def: unknown) => def),
}));

vi.mock("ai", () => ({ tool: mocks.tool }));

vi.mock("@/server/core/app-logger", () => ({ appLogger: mocks.appLogger }));

vi.mock("@/server/core/db", () => ({ prisma: mocks.prisma }));

vi.mock("@/server/core/github/github-browse.service", () => ({
  githubBrowseService: mocks.githubBrowseService,
}));

vi.mock("@/server/core/trpc/server", () => ({ apiForUser: mocks.apiForUser }));

vi.mock("@/server/utils/optimizers", () => ({ CodeOptimizer: mocks.CodeOptimizer }));

import { buildRepositoryToolProfile } from "./ai-tools";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function buildTools(profile: Parameters<typeof buildRepositoryToolProfile>[0]) {
  return buildRepositoryToolProfile(profile, 1, "repo-uuid", "main");
}

type ToolValue = {
  description: string;
  execute: (input: Record<string, unknown>) => Promise<unknown>;
  inputSchema: z.ZodTypeAny;
};

function getTool(toolSet: Record<string, unknown>, name: string): ToolValue {
  return toolSet[name] as ToolValue;
}

// ---------------------------------------------------------------------------
// readMultipleFiles execute
// ---------------------------------------------------------------------------
describe("readMultipleFiles execute", () => {
  it("returns array of results for multiple paths", async () => {
    mocks.githubBrowseService.getFileContent
      .mockResolvedValueOnce({ content: "aa" })
      .mockResolvedValueOnce({ content: "bb" });

    const tools = buildTools("architect");
    const result = (await getTool(tools, "readMultipleFiles").execute({
      paths: ["a.ts", "b.ts"],
    })) as Array<Record<string, unknown>>;

    expect(result).toHaveLength(2);
    expect(result[0]!.content).toBe("optimized:aa");
    expect(result[1]!.content).toBe("optimized:bb");
  });

  it("returns error result for individual path failures", async () => {
    mocks.githubBrowseService.getFileContent
      .mockResolvedValueOnce({ content: "ok" })
      .mockRejectedValueOnce(new Error("bad"));

    const tools = buildTools("architect");
    const result = (await getTool(tools, "readMultipleFiles").execute({
      paths: ["ok.ts", "bad.ts"],
    })) as Array<Record<string, unknown>>;

    expect(result).toHaveLength(2);
    expect(result[0]!.success).toBe(true);
    expect(result[1]!.success).toBe(false);
    expect(result[1]!.content).toContain("bad.ts");
  });
});

// ---------------------------------------------------------------------------
// readPreviousDocument execute
// ---------------------------------------------------------------------------
describe("readPreviousDocument execute", () => {
  it("returns doc content when found", async () => {
    mocks.prisma.repo.findUnique.mockResolvedValue({ id: 1 });
    mocks.prisma.document.findFirst.mockResolvedValue({
      content: "doc content",
      type: "README",
      version: 1,
    });

    const tools = buildTools("writer_readme");
    const result = (await getTool(tools, "readPreviousDocument").execute({
      docType: "README",
    })) as Record<string, unknown>;

    expect(result.content).toBe("doc content");
    expect(result.type).toBe("README");
    expect(result.version).toBe(1);
  });

  it("returns no-doc message when doc is null", async () => {
    mocks.prisma.repo.findUnique.mockResolvedValue({ id: 1 });
    mocks.prisma.document.findFirst.mockResolvedValue(null);

    const tools = buildTools("writer_readme");
    const result = await getTool(tools, "readPreviousDocument").execute({ docType: "API" });

    expect(typeof result).toBe("string");
    expect(result).toContain("API");
    expect(result).toContain("No previous documentation");
  });

  it("returns repo-not-found when repo is null", async () => {
    mocks.prisma.repo.findUnique.mockResolvedValue(null);

    const tools = buildTools("writer_readme");
    const result = await getTool(tools, "readPreviousDocument").execute({ docType: "README" });

    expect(result).toBe("Error: Repository not found.");
  });

  it("returns error on db exception", async () => {
    mocks.prisma.repo.findUnique.mockRejectedValue(new Error("db down"));

    const tools = buildTools("writer_readme");
    const result = await getTool(tools, "readPreviousDocument").execute({ docType: "README" });

    expect(typeof result).toBe("string");
    expect(result).toContain("Error reading previous document");
    expect(mocks.appLogger.error).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getLatestAnalysis execute
// ---------------------------------------------------------------------------
describe("getLatestAnalysis execute", () => {
  it("calls apiForUser and returns trpc.analysis.getLatest result", async () => {
    mocks.apiForUser.mockResolvedValue({
      analysis: { getLatest: vi.fn().mockResolvedValue({ status: "COMPLETED" }) },
    });

    const tools = buildTools("github_agent");
    const result = await getTool(tools, "getLatestAnalysis").execute({});

    expect(mocks.apiForUser).toHaveBeenCalledWith(1);
    expect(result).toEqual({ status: "COMPLETED" });
  });

  it("uses provided repoId when given", async () => {
    const getLatest = vi.fn().mockResolvedValue({ status: "PENDING" });
    mocks.apiForUser.mockResolvedValue({ analysis: { getLatest } });

    const tools = buildTools("github_agent");
    await getTool(tools, "getLatestAnalysis").execute({ repoId: "custom-id" });

    expect(getLatest).toHaveBeenCalledWith({ repoId: "custom-id" });
  });
});

// ---------------------------------------------------------------------------
// triggerRepositoryAnalysis execute
// ---------------------------------------------------------------------------
describe("triggerRepositoryAnalysis execute", () => {
  it("calls trpc.analysis.analyze with correct params", async () => {
    const analyze = vi.fn().mockResolvedValue({ ok: true });
    mocks.apiForUser.mockResolvedValue({ analysis: { analyze } });

    const tools = buildTools("github_agent");
    const result = await getTool(tools, "triggerRepositoryAnalysis").execute({});

    expect(analyze).toHaveBeenCalledWith({
      branch: undefined,
      docTypes: ["README", "API", "ARCHITECTURE", "CONTRIBUTING", "CHANGELOG"],
      files: ["**/*"],
      language: "English",
      repoId: "repo-uuid",
    });
    expect(result).toEqual({ ok: true });
  });

  it("uses provided branch and repoId", async () => {
    const analyze = vi.fn().mockResolvedValue({ ok: true });
    mocks.apiForUser.mockResolvedValue({ analysis: { analyze } });

    const tools = buildTools("github_agent");
    await getTool(tools, "triggerRepositoryAnalysis").execute({
      branch: "dev",
      repoId: "custom-repo",
    });

    expect(analyze).toHaveBeenCalledWith(
      expect.objectContaining({ branch: "dev", repoId: "custom-repo" }),
    );
  });
});

// ---------------------------------------------------------------------------
// searchCode execute
// ---------------------------------------------------------------------------
describe("searchCode execute", () => {
  it("returns formatted search results", async () => {
    mocks.apiForUser.mockResolvedValue({
      analysis: {
        searchWorkspace: vi.fn().mockResolvedValue([
          {
            description: "a function",
            docSectionId: null,
            docType: null,
            label: "foo",
            path: "a.ts",
            score: 0.9,
          },
        ]),
      },
    });

    const tools = buildTools("mapper");
    const result = await getTool(tools, "searchCode").execute({ search: "foo" });

    expect(typeof result).toBe("string");
    expect(result).toContain("[[a.ts]]");
    expect(result).toContain("foo");
  });

  it("returns no-results message", async () => {
    mocks.apiForUser.mockResolvedValue({
      analysis: { searchWorkspace: vi.fn().mockResolvedValue([]) },
    });

    const tools = buildTools("mapper");
    const result = await getTool(tools, "searchCode").execute({ search: "zzz" });

    expect(typeof result).toBe("string");
    expect(result).toContain("No relevant code");
  });
});
