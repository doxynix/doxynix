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
// Profile → key selection
// ---------------------------------------------------------------------------
const profileExpectedKeys: Record<string, string[]> = {
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
  describe(`buildRepositoryToolProfile("${profile}")`, () => {
    it("returns the correct tool keys", () => {
      const tools = buildTools(profile as Parameters<typeof buildRepositoryToolProfile>[0]);
      const keys = Object.keys(tools).sort();
      expect(keys).toEqual(expected.sort());
    });

    it("each tool has a description and execute function", () => {
      const tools = buildTools(profile as Parameters<typeof buildRepositoryToolProfile>[0]);
      for (const toolDef of Object.values(tools)) {
        expect(typeof toolDef.description).toBe("string");
        expect(typeof toolDef.execute).toBe("function");
      }
    });
  });
}

describe("buildRepositoryToolProfile with unknown profile", () => {
  it("throws for unrecognized profile key", () => {
    // @ts-expect-error testing invalid profile
    expect(() => buildRepositoryToolProfile("writer_x", 1, "repo-uuid", "main")).toThrow(
      "is not iterable",
    );
  });
});

// ---------------------------------------------------------------------------
// Tool inputSchema shapes
// ---------------------------------------------------------------------------
describe("inputSchema shapes", () => {
  it("readFile has required path string and optional skeletonize boolean", () => {
    const tools = buildTools("architect");
    const schema = getTool(tools, "readFile").inputSchema;
    expect(schema).toBeDefined();
    // Validate with a correct input
    const parsed = schema.safeParse({ path: "src/index.ts" });
    expect(parsed.success).toBe(true);
    // Validate with skeletonize
    const parsed2 = schema.safeParse({ path: "src/index.ts", skeletonize: false });
    expect(parsed2.success).toBe(true);
  });

  it("listFiles has optional prefix string", () => {
    const tools = buildTools("mapper");
    const schema = getTool(tools, "listFiles").inputSchema;
    const parsed = schema.safeParse({ prefix: "src" });
    expect(parsed.success).toBe(true);
    const parsed2 = schema.safeParse({});
    expect(parsed2.success).toBe(true);
  });

  it("readPreviousDocument has docType enum", () => {
    const tools = buildTools("writer_readme");
    const schema = getTool(tools, "readPreviousDocument").inputSchema;
    const parsed = schema.safeParse({ docType: "README" });
    expect(parsed.success).toBe(true);
    const parsed2 = schema.safeParse({ docType: "INVALID" });
    expect(parsed2.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// listFiles execute
// ---------------------------------------------------------------------------
describe("listFiles execute", () => {
  it("returns newline-joined file paths", async () => {
    mocks.prisma.repo.findUnique.mockResolvedValue({ name: "repo", owner: "acme" });
    mocks.githubBrowseService.getRepoFiles.mockResolvedValue([["a.ts"], ["b/c.ts"]]);

    const tools = buildTools("mapper");
    const result = await getTool(tools, "listFiles").execute({});

    expect(result).toBe("a.ts\nb/c.ts");
  });

  it("filters by prefix", async () => {
    mocks.prisma.repo.findUnique.mockResolvedValue({ name: "repo", owner: "acme" });
    mocks.githubBrowseService.getRepoFiles.mockResolvedValue([["a.ts"], ["b/c.ts"]]);

    const tools = buildTools("mapper");
    const result = await getTool(tools, "listFiles").execute({ prefix: "b" });

    expect(result).toBe("b/c.ts");
  });

  it("returns error when repo not found", async () => {
    mocks.prisma.repo.findUnique.mockResolvedValue(null);

    const tools = buildTools("mapper");
    const result = await getTool(tools, "listFiles").execute({});

    expect(result).toBe("Error: Repo not found");
  });

  it("returns error on githubBrowseService failure", async () => {
    mocks.prisma.repo.findUnique.mockResolvedValue({ name: "repo", owner: "acme" });
    mocks.githubBrowseService.getRepoFiles.mockRejectedValue(new Error("network"));

    const tools = buildTools("mapper");
    const result = await getTool(tools, "listFiles").execute({});

    expect(result).toBe("Error listing files.");
    expect(mocks.appLogger.error).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// readFile execute
// ---------------------------------------------------------------------------
describe("readFile execute", () => {
  it("returns skeletonized content by default", async () => {
    mocks.githubBrowseService.getFileContent.mockResolvedValue({ content: "src" });

    const tools = buildTools("architect");
    const result = (await getTool(tools, "readFile").execute({
      path: "x.ts",
    })) as Record<string, unknown>;

    expect(result.content).toBe("optimized:src");
    expect(result.path).toBe("x.ts");
    expect(result.skeletonized).toBe(true);
  });

  it("returns cleaned content when skeletonize=false", async () => {
    mocks.githubBrowseService.getFileContent.mockResolvedValue({ content: "src" });

    const tools = buildTools("architect");
    const result = (await getTool(tools, "readFile").execute({
      path: "x.ts",
      skeletonize: false,
    })) as Record<string, unknown>;

    expect(result.content).toBe("clean:src");
    expect(result.skeletonized).toBe(false);
  });

  it("returns error string on failure", async () => {
    mocks.githubBrowseService.getFileContent.mockRejectedValue(new Error("not found"));

    const tools = buildTools("architect");
    const result = await getTool(tools, "readFile").execute({ path: "missing.ts" });

    expect(typeof result).toBe("string");
    expect(result).toContain("missing.ts");
    expect(mocks.appLogger.warn).toHaveBeenCalled();
  });
});
