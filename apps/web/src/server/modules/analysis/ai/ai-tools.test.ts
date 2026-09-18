import { describe, expect, it, vi } from "vitest";
import type { z } from "zod";

// ── Hoisted mocks ────────────────────────────────────────────────────────────
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

import { buildRepositoryToolProfile, type RepositoryToolProfile } from "./ai-tools";

// ── Helpers ──────────────────────────────────────────────────────────────────
function buildTools(profile: RepositoryToolProfile) {
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

// ── Tests ────────────────────────────────────────────────────────────────────
describe("ai-tools profile composition", () => {
  const profileExpectedKeys: Record<RepositoryToolProfile, string[]> = {
    architect: ["readFile", "readMultipleFiles", "searchCode"],
    file_action: ["readFile", "readMultipleFiles", "searchCode"],
    fixer: ["readFile", "readMultipleFiles"],
    github_agent: [
      "getLatestAnalysis",
      "listFiles",
      "readFile",
      "readMultipleFiles",
      "readPreviousDocument",
      "searchCode",
      "triggerRepositoryAnalysis",
    ],
    mapper: ["listFiles", "readFile", "searchCode"],
    pr_review: ["readFile", "readMultipleFiles", "searchCode"],
    writer_api: ["readFile", "readMultipleFiles", "searchCode"],
    writer_architecture: ["readFile", "readMultipleFiles", "readPreviousDocument", "searchCode"],
    writer_contributing: ["readFile", "readPreviousDocument", "searchCode"],
    writer_readme: ["readFile", "readPreviousDocument"],
  };

  for (const [profile, expected] of Object.entries(profileExpectedKeys)) {
    it(`configures correct tools for profile "${profile}"`, () => {
      const tools = buildTools(profile as RepositoryToolProfile);
      expect(Object.keys(tools).sort()).toEqual(expected.sort());
    });
  }

  it("throws for unrecognized profile key", () => {
    // @ts-expect-error testing runtime invalid profile
    expect(() => buildRepositoryToolProfile("invalid_profile", 1, "repo-uuid", "main")).toThrow(
      "is not iterable",
    );
  });
});

describe("ai-tools input schemas", () => {
  it("validates readFile schema", () => {
    const schema = getTool(buildTools("architect"), "readFile").inputSchema;
    expect(schema.safeParse({ path: "src/index.ts" }).success).toBe(true);
    expect(schema.safeParse({ path: "src/index.ts", skeletonize: false }).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(false);
  });

  it("validates readPreviousDocument docType enum", () => {
    const schema = getTool(buildTools("writer_readme"), "readPreviousDocument").inputSchema;
    expect(schema.safeParse({ docType: "README" }).success).toBe(true);
    expect(schema.safeParse({ docType: "INVALID" }).success).toBe(false);
  });
});

describe("ai-tools execution logic", () => {
  describe("readFile & readMultipleFiles", () => {
    it("returns skeletonized code by default and raw code when skeletonize is false", async () => {
      mocks.githubBrowseService.getFileContent.mockResolvedValue({ content: "const x = 1;" });
      const tool = getTool(buildTools("architect"), "readFile");

      const defaultResult = (await tool.execute({ path: "src/a.ts" })) as any;
      expect(defaultResult.content).toBe("optimized:const x = 1;");
      expect(defaultResult.skeletonized).toBe(true);

      const rawResult = (await tool.execute({ path: "src/a.ts", skeletonize: false })) as any;
      expect(rawResult.content).toBe("clean:const x = 1;");
      expect(rawResult.skeletonized).toBe(false);
    });

    it("readMultipleFiles isolates errors per file without failing the whole batch", async () => {
      mocks.githubBrowseService.getFileContent
        .mockResolvedValueOnce({ content: "file-1" })
        .mockRejectedValueOnce(new Error("File not found"));

      const tool = getTool(buildTools("architect"), "readMultipleFiles");
      const result = (await tool.execute({ paths: ["a.ts", "missing.ts"] })) as any[];

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        content: "optimized:file-1",
        path: "a.ts",
        skeletonized: true,
        success: true,
      });
      expect(result[1]).toEqual({
        content: "Error: Could not read missing.ts",
        path: "missing.ts",
        success: false,
      });
    });
  });

  describe("listFiles", () => {
    it("lists files and applies prefix filtering", async () => {
      mocks.prisma.repo.findUnique.mockResolvedValue({ name: "repo", owner: "acme" });
      mocks.githubBrowseService.getRepoFiles.mockResolvedValue([
        ["src/app.ts"],
        ["src/utils/math.ts"],
        ["docs/readme.md"],
      ]);

      const tool = getTool(buildTools("mapper"), "listFiles");

      const allFiles = await tool.execute({});
      expect(allFiles).toBe("src/app.ts\nsrc/utils/math.ts\ndocs/readme.md");

      const filtered = await tool.execute({ prefix: "src/utils" });
      expect(filtered).toBe("src/utils/math.ts");
    });
  });

  describe("readPreviousDocument", () => {
    it("returns previous document content when found in database", async () => {
      mocks.prisma.repo.findUnique.mockResolvedValue({ id: 10 });
      mocks.prisma.document.findFirst.mockResolvedValue({
        content: "# Existing API",
        type: "API",
        version: "v1",
      });

      const tool = getTool(buildTools("writer_readme"), "readPreviousDocument");
      const result = (await tool.execute({ docType: "API" })) as any;

      expect(result.content).toBe("# Existing API");
      expect(result.type).toBe("API");
    });

    it("returns friendly note when no previous document exists (first analysis)", async () => {
      mocks.prisma.repo.findUnique.mockResolvedValue({ id: 10 });
      mocks.prisma.document.findFirst.mockResolvedValue(null);

      const tool = getTool(buildTools("writer_readme"), "readPreviousDocument");
      const result = await tool.execute({ docType: "README" });

      expect(result).toContain('No previous documentation of type "README" exists yet');
      expect(result).toContain("This is the first analysis");
    });
  });

  describe("searchCode", () => {
    it("formats search results with [[path]] notation for LLM grounding", async () => {
      mocks.apiForUser.mockResolvedValue({
        analysis: {
          searchWorkspace: vi.fn().mockResolvedValue([
            {
              description: "auth helper",
              docSectionId: null,
              docType: null,
              label: "checkAuth",
              path: "src/auth.ts",
              score: 0.95,
            },
          ]),
        },
      });

      const tool = getTool(buildTools("mapper"), "searchCode");
      const result = (await tool.execute({ search: "checkAuth" })) as string;

      expect(result).toContain("[[src/auth.ts]]");
      expect(result).toContain("checkAuth: auth helper");
    });
  });
});
