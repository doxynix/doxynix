import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  appLogger: {
    debug: vi.fn(),
    error: vi.fn(),
    flush: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
  getLanguageColor: vi.fn(() => "#cccccc"),
  hasText: vi.fn((value: unknown) => typeof value === "string" && value.length > 0),
  markdownToHtml: vi.fn(async (input: { content: string }) => `<p>${input.content}</p>`),
  unstable_cache: vi.fn((fn: () => unknown) => fn),
}));

vi.mock("next/cache", () => ({ unstable_cache: mocks.unstable_cache }));
vi.mock("@/server/core/app-logger", () => ({ appLogger: mocks.appLogger }));
vi.mock("@/server/utils/language-metadata", () => ({ getLanguageColor: mocks.getLanguageColor }));
vi.mock("@/server/utils/markdown-to-html", () => ({ markdownToHtml: mocks.markdownToHtml }));
vi.mock("@/server/utils/string-utils", () => ({ hasText: mocks.hasText }));

import type { PRImpactPayload } from "@/server/utils/types";

import { analysisMapper } from "./analysis.mapper";
import type { LatestCompletedAnalysis, RepoWithLatestAnalysisAndDocs } from "./analysis.repository";
import type { ImpactAnalysis, ParsedFinding } from "./analysis.schemas";
import type { AIResult } from "./engine/core/analysis-result.schemas";
import type { RepoMetrics } from "./engine/core/metrics.types";
import defaultAiResult from "./fixtures/default-ai-result.json";
import defaultMetrics from "./fixtures/default-metrics.json";
import type { StructureNodePayload } from "./logic/graph-navigator";
import type { NodeExplainPayload } from "./logic/node-explainer";
import type { StoredDocument } from "./logic/structure-shared";

type TopLevelNode = {
  id: string;
  kind: string;
  label: string;
  nodeType: "file" | "group";
  path: string;
};
type AnalyzeContextLike = Parameters<typeof analysisMapper.buildAffectedNodes>[2];
type DetailCache = Parameters<typeof analysisMapper.buildAffectedNodes>[4];

const makeAiResult = (overrides: Partial<AIResult> = {}): AIResult => ({
  ...(defaultAiResult as unknown as AIResult),
  ...overrides,
});

const makeMetrics = (overrides: Partial<RepoMetrics> = {}): RepoMetrics => ({
  ...(defaultMetrics as unknown as RepoMetrics),
  ...overrides,
});

const makeAnalysis = (
  resultJson: unknown,
  metricsJson: unknown = makeMetrics(),
): LatestCompletedAnalysis =>
  ({
    commitSha: "abc123",
    complexityScore: 50,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    metricsJson,
    onboardingScore: 20,
    publicId: "an-1",
    resultJson,
    score: 70,
    securityScore: 60,
    status: "DONE",
    techDebtScore: 30,
  }) as unknown as LatestCompletedAnalysis;

const makeRepoFact = (
  overrides: Partial<RepoWithLatestAnalysisAndDocs> = {},
): RepoWithLatestAnalysisAndDocs =>
  ({
    analyses: [],
    defaultBranch: "main",
    description: "A repo",
    documents: [],
    forks: 12,
    language: "TypeScript",
    license: "MIT",
    name: "doxynix",
    openIssues: 4,
    owner: "ivan",
    ownerAvatarUrl: "https://avatars.ivan",
    publicId: "repo-1",
    pushedAt: new Date("2024-01-01T00:00:00.000Z"),
    size: 1024,
    stars: 22,
    topics: ["typescript"],
    url: "https://github.com/ivan/doxynix",
    visibility: "public",
    ...overrides,
  }) as unknown as RepoWithLatestAnalysisAndDocs;

const makeDoc = (overrides: Partial<StoredDocument>): StoredDocument =>
  ({
    analysis: { publicId: "an-1" },
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    path: "README.md",
    publicId: "doc-readme",
    type: "README",
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    version: "1",
    ...overrides,
  }) as unknown as StoredDocument;

type ChangedFile = PRImpactPayload["changedFiles"][number];

const makeChangedFile = (overrides: Partial<ChangedFile> = {}): ChangedFile => ({
  additions: 10,
  deletions: 5,
  filePath: "src/a.ts",
  findingCount: 1,
  nodeId: null,
  nodeLabel: null,
  previousFilePath: null,
  status: "modified",
  targetView: "code",
  zoneId: null,
  zoneLabel: null,
  ...overrides,
});

const makeFinding = (overrides: Partial<ParsedFinding> = {}): ParsedFinding => ({
  file: "src/a.ts",
  line: 10,
  message: "found a bug",
  score: 5,
  title: "Bug",
  type: "security",
  ...overrides,
});

const makeStructureNode = (overrides: Record<string, unknown> = {}): StructureNodePayload =>
  ({
    breadcrumbs: [{ id: "b1", label: "src", path: "src" }],
    canDrillDeeper: false,
    children: [],
    edges: [],
    inspect: { kind: "file", title: "a.ts" },
    node: {
      canDrillDeeper: false,
      description: "desc",
      id: "file:src/a.ts",
      kind: "file",
      label: "a.ts",
      markers: {
        api: true,
        client: false,
        config: false,
        entrypoint: false,
        risk: false,
        server: false,
        shared: false,
      },
      nodeType: "file",
      path: "src/a.ts",
      previewPaths: [],
      score: 50,
      stats: {},
    },
    ...overrides,
  }) as unknown as StructureNodePayload;

const makeExplain = (overrides: Record<string, unknown> = {}): NodeExplainPayload =>
  ({
    analysisRef: null,
    confidence: "high",
    nextSuggestedPaths: [],
    relationships: {},
    role: "worker",
    sourcePaths: [],
    summary: ["summary"],
    whyImportant: "why",
    ...overrides,
  }) as unknown as NodeExplainPayload;

const makeContext = (nodes: Record<string, StructureNodePayload | null> = {}): AnalyzeContextLike =>
  ({
    getStructureNode: vi.fn((nodeId: string) => nodes[nodeId] ?? null),
  }) as unknown as AnalyzeContextLike;

const makeImpactAnalysis = (overrides: Record<string, unknown> = {}): ImpactAnalysis =>
  ({
    baseSha: "base",
    changedFilesJson: [],
    comments: [],
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    findingsJson: [],
    generatedFixes: [],
    headSha: "head",
    prNumber: 1,
    publicId: "pa-1",
    riskScore: null,
    status: "DONE",
    ...overrides,
  }) as unknown as ImpactAnalysis;

const topLevelNode = (overrides: Partial<TopLevelNode> = {}): TopLevelNode => ({
  id: "group:src",
  kind: "group",
  label: "src",
  nodeType: "group",
  path: "src",
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.unstable_cache.mockImplementation((fn: () => unknown) => fn);
  mocks.getLanguageColor.mockReturnValue("#cccccc");
  mocks.markdownToHtml.mockImplementation(
    async (input: { content: string }) => `<p>${input.content}</p>`,
  );
  mocks.hasText.mockImplementation(
    (value: unknown) => typeof value === "string" && value.length > 0,
  );
});

describe("coerceAnalysisPayload", () => {
  it("null/undefined and empty JSON → null", () => {
    expect(analysisMapper.coerceAnalysisPayload(null)).toBeNull();
    expect(analysisMapper.coerceAnalysisPayload(undefined)).toBeNull();
    expect(analysisMapper.coerceAnalysisPayload(makeAnalysis(null))).toBeNull();
    expect(analysisMapper.coerceAnalysisPayload(makeAnalysis({}, null))).toBeNull();
  });

  it("parses a valid resultJson without warn", () => {
    const aiResult = makeAiResult();
    const analysis = makeAnalysis(aiResult);

    const result = analysisMapper.coerceAnalysisPayload(analysis);

    expect(result?.aiResult).toEqual(aiResult);
    expect(result?.analysis).toBe(analysis);
    expect(mocks.appLogger.warn).not.toHaveBeenCalled();
  });

  it("invalid resultJson → warn + raw passthrough", () => {
    const invalid = { ...makeAiResult(), refactoring_targets: "oops" } as unknown as AIResult;
    const analysis = makeAnalysis(invalid);

    const result = analysisMapper.coerceAnalysisPayload(analysis);

    expect(result?.aiResult).toBe(invalid);
    expect(mocks.appLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ id: "an-1", msg: "Zod mismatch" }),
    );
  });
});

describe("computeImpactScore", () => {
  it("base case: 0 files/findings/markers → 0", () => {
    expect(
      analysisMapper.computeImpactScore([], 0, { api: false, entrypoint: false, risk: false }),
    ).toBe(0);
  });

  it("intensity = ceil(add+del/20) per file with cap 18", () => {
    const files = [
      { additions: 20, deletions: 0 },
      { additions: 5000, deletions: 0 },
    ] as Array<Pick<PRImpactPayload["changedFiles"][number], "additions" | "deletions">>;
    expect(
      analysisMapper.computeImpactScore(files, 0, { api: false, entrypoint: false, risk: false }),
    ).toBe(19);
  });

  it("adds a boost from findings and markers, cap 100", () => {
    const files = [
      { additions: 5000, deletions: 0 },
      { additions: 5000, deletions: 0 },
    ] as Array<Pick<PRImpactPayload["changedFiles"][number], "additions" | "deletions">>;
    expect(
      analysisMapper.computeImpactScore(files, 3, { api: true, entrypoint: true, risk: true }),
    ).toBe(100);
  });
});

describe("countFindingsByFile", () => {
  it("counts findings by file", () => {
    const findings = [
      makeFinding(),
      makeFinding({ file: "src/a.ts" }),
      makeFinding({ file: "src/b.ts" }),
    ];
    expect([...analysisMapper.countFindingsByFile(findings).entries()]).toEqual([
      ["src/a.ts", 2],
      ["src/b.ts", 1],
    ]);
  });

  it("empty input → empty map", () => {
    expect(analysisMapper.countFindingsByFile([]).size).toBe(0);
  });
});

describe("matchTopLevelZone", () => {
  const nodes = [
    topLevelNode({ id: "group:src", path: "src" }),
    topLevelNode({ id: "group:src/api", kind: "api", label: "api", path: "src/api" }),
  ];

  it("selects the longest matching scope", () => {
    expect(analysisMapper.matchTopLevelZone(nodes, "src/api/routes/a.ts", null)?.id).toBe(
      "group:src/api",
    );
  });

  it("falls back to previousFilePath, otherwise null", () => {
    expect(analysisMapper.matchTopLevelZone(nodes, "lib/x.ts", null)).toBeNull();
    expect(analysisMapper.matchTopLevelZone(nodes, "lib/x.ts", "src/api/b.ts")?.id).toBe(
      "group:src/api",
    );
  });
});

describe("parseChangedFilesSnapshot", () => {
  it("valid snapshot → normalizes paths and passes through fields", () => {
    const analysis = makeImpactAnalysis({
      changedFilesJson: [
        { additions: 3, deletions: 1, filePath: "src/./a.ts", status: "modified" },
        {
          additions: 0,
          deletions: 0,
          filePath: "src/b.ts",
          previousFilePath: "old/./b.ts",
          status: "renamed",
        },
      ],
    });

    expect(analysisMapper.parseChangedFilesSnapshot(analysis)).toEqual([
      {
        additions: 3,
        deletions: 1,
        filePath: "src/a.ts",
        previousFilePath: null,
        status: "modified",
      },
      {
        additions: 0,
        deletions: 0,
        filePath: "src/b.ts",
        previousFilePath: "old/b.ts",
        status: "renamed",
      },
    ]);
  });

  it("invalid snapshot → legacy paths from comments and findings (modified, zeros)", () => {
    const analysis = makeImpactAnalysis({
      changedFilesJson: [{ additions: -1, deletions: 0, filePath: "", status: "bogus" }],
      comments: [
        {
          body: "b",
          filePath: "src/legacy.ts",
          findingType: "BUG",
          line: 1,
          publicId: "c1",
          riskLevel: 7,
        },
      ],
      findingsJson: [
        { file: "src/./other.ts", line: 2, message: "m", title: "t", type: "security" },
      ],
    });

    expect(analysisMapper.parseChangedFilesSnapshot(analysis)).toEqual([
      {
        additions: 0,
        deletions: 0,
        filePath: "src/legacy.ts",
        previousFilePath: null,
        status: "modified",
      },
      {
        additions: 0,
        deletions: 0,
        filePath: "src/other.ts",
        previousFilePath: null,
        status: "modified",
      },
    ]);
  });
});

describe("parsePersistedFindings", () => {
  it("valid findingsJson → normalizes file", () => {
    const analysis = makeImpactAnalysis({
      findingsJson: [{ file: "src/./a.ts", line: 1, message: "m", title: "t", type: "security" }],
    });

    expect(analysisMapper.parsePersistedFindings(analysis)).toEqual([
      { file: "src/a.ts", line: 1, message: "m", title: "t", type: "security" },
    ]);
  });

  it("invalid findingsJson → falls back to comments", () => {
    const analysis = makeImpactAnalysis({
      comments: [
        {
          body: "b",
          filePath: "src/c.ts",
          findingType: "BUG",
          line: 1,
          publicId: "c1",
          riskLevel: 7,
        },
      ],
      findingsJson: [{ file: "", line: 0, message: "", title: "", type: "" }],
    });

    expect(analysisMapper.parsePersistedFindings(analysis)).toEqual([
      { file: "src/c.ts", line: 1, message: "b", score: 7, title: "BUG", type: "BUG" },
    ]);
  });
});

describe("resolveMatchedNode", () => {
  it("group-nodeId → record from topLevelNodeById with markers null", () => {
    const zones = new Map<string, unknown>([["group:src", topLevelNode()]]) as Map<
      string,
      TopLevelNode
    >;
    const node = analysisMapper.resolveMatchedNode("group:src", makeContext(), zones, new Map());

    expect(node).toMatchObject({ id: "group:src", path: "src" });
    expect(node?.markers).toBeNull();
  });

  it("file-nodeId: takes from cache or context, hiding null", () => {
    const structure = makeStructureNode();
    const detailCache = new Map<string, StructureNodePayload | null>([
      ["file:src/a.ts", structure],
    ]);
    const context = makeContext({
      "file:src/a.ts": makeStructureNode({ node: { ...structure.node, label: "other" } }),
    });

    const hit = analysisMapper.resolveMatchedNode("file:src/a.ts", context, new Map(), detailCache);
    expect(hit).toBe(structure.node);

    const miss = analysisMapper.resolveMatchedNode(
      "file:src/missing.ts",
      context,
      new Map(),
      new Map(),
    );
    expect(miss).toBeNull();
    expect(context.getStructureNode).toHaveBeenCalledWith("file:src/missing.ts");
  });
});

describe("selectPrimaryFile", () => {
  it("empty list → null", () => {
    expect(analysisMapper.selectPrimaryFile([])).toBeNull();
  });

  it("selects the file with the highest score = findingCount*20 + add + del", () => {
    const files = [
      makeChangedFile({ additions: 100, deletions: 0, filePath: "src/a.ts", findingCount: 0 }),
      makeChangedFile({ additions: 0, deletions: 0, filePath: "src/b.ts", findingCount: 6 }),
    ];
    expect(analysisMapper.selectPrimaryFile(files)?.filePath).toBe("src/b.ts");
  });

  it("ties in score — picks the lexicographically smaller path", () => {
    const files = [
      makeChangedFile({ additions: 10, deletions: 0, filePath: "z.ts", findingCount: 0 }),
      makeChangedFile({ additions: 10, deletions: 0, filePath: "a.ts", findingCount: 0 }),
    ];
    expect(analysisMapper.selectPrimaryFile(files)?.filePath).toBe("a.ts");
  });
});

describe("toAnalysisRef", () => {
  it("null/undefined → null", () => {
    expect(analysisMapper.toAnalysisRef(null)).toBeNull();
    expect(analysisMapper.toAnalysisRef(undefined)).toBeNull();
  });

  it("maps publicId/commitSha/createdAt", () => {
    const analysis = makeAnalysis(makeAiResult());
    expect(analysisMapper.toAnalysisRef(analysis)).toEqual({
      analysisId: "an-1",
      commitSha: "abc123",
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
    });
  });
});

describe("buildAffectedNodes", () => {
  it("groups by nodeId, computes impact, and sorts", () => {
    const files = [
      makeChangedFile({ filePath: "src/a.ts", nodeId: "file:src/a.ts", zoneId: "group:src" }),
      makeChangedFile({
        additions: 0,
        deletions: 0,
        filePath: "src/b.ts",
        findingCount: 0,
        nodeId: "file:src/a.ts",
        zoneId: "group:src",
      }),
    ];
    const findings = [makeFinding(), makeFinding({ line: 20 })];
    const structure = makeStructureNode();
    const detailCache = new Map([["file:src/a.ts", structure]]) as DetailCache;

    const result = analysisMapper.buildAffectedNodes(
      files,
      findings,
      makeContext(),
      new Map(),
      detailCache,
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      fileCount: 2,
      findingCount: 2,
      impactScore: 35,
      kind: "file",
      label: "a.ts",
      nodeId: "file:src/a.ts",
      nodeType: "file",
      path: "src/a.ts",
      relatedChangedFiles: ["src/a.ts", "src/b.ts"],
      whyAffected: "2 changed file(s) and 2 linked finding(s) touch this node.",
      zoneId: "group:src",
    });
  });

  it("skips files without nodeId and unresolved nodeIds", () => {
    const result = analysisMapper.buildAffectedNodes(
      [
        makeChangedFile({ nodeId: null }),
        makeChangedFile({ filePath: "src/x.ts", nodeId: "file:src/x.ts" }),
      ],
      [],
      makeContext(),
      new Map(),
      new Map(),
    );
    expect(result).toEqual([]);
  });

  it("sorts by impactScore desc, then label asc; default group markers", () => {
    const files = [
      makeChangedFile({
        additions: 400,
        deletions: 0,
        filePath: "src/z.ts",
        nodeId: "group:z",
        zoneId: "group:z",
      }),
      makeChangedFile({ filePath: "src/a.ts", nodeId: "group:a", zoneId: "group:a" }),
    ];
    const zones = new Map<string, unknown>([
      ["group:z", topLevelNode({ id: "group:z", label: "z" })],
      ["group:a", topLevelNode({ id: "group:a", label: "a" })],
    ]) as Map<string, TopLevelNode>;

    const result = analysisMapper.buildAffectedNodes(files, [], makeContext(), zones, new Map());

    expect(result.map((item) => item.nodeId)).toEqual(["group:z", "group:a"]);
    expect(result[0]?.impactScore).toBeGreaterThan(result[1]?.impactScore ?? 0);
    expect(result[0]?.whyAffected).toBe(
      "1 changed file(s) and 0 linked finding(s) touch this node.",
    );
  });
});

describe("buildAffectedZones", () => {
  it("groups by zoneId and sums impact", () => {
    const files = [
      makeChangedFile({ filePath: "src/a.ts", findingCount: 2, zoneId: "group:src" }),
      makeChangedFile({
        additions: 0,
        deletions: 0,
        filePath: "src/b.ts",
        findingCount: 0,
        zoneId: "group:src",
      }),
    ];
    const findings = [makeFinding()];
    const zones = new Map<string, unknown>([["group:src", topLevelNode()]]) as Map<
      string,
      TopLevelNode
    >;

    const result = analysisMapper.buildAffectedZones(files, findings, zones);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      fileCount: 2,
      findingCount: 1,
      impactScore: 19,
      kind: "group",
      label: "src",
      nodeId: "group:src",
      relatedChangedFiles: ["src/a.ts", "src/b.ts"],
    });
  });

  it("skips files without zoneId and unknown zones", () => {
    const result = analysisMapper.buildAffectedZones(
      [makeChangedFile({ zoneId: null }), makeChangedFile({ zoneId: "group:ghost" })],
      [],
      new Map(),
    );
    expect(result).toEqual([]);
  });
});

describe("buildTopFindings", () => {
  it("sorts by riskLevel desc and renders messageHtml through unstable_cache", async () => {
    const findings = [
      makeFinding({
        file: "src/a.ts",
        line: 10,
        message: "low",
        score: 3,
        title: "T1",
        type: "security",
      }),
      makeFinding({
        file: "src/b.ts",
        line: 2,
        message: "high",
        score: 9,
        title: "T2",
        type: "performance",
      }),
    ];
    const files = [
      makeChangedFile({ filePath: "src/a.ts", nodeId: "file:src/a.ts", zoneId: "group:src" }),
    ];
    const zoneLabels = new Map<string, unknown>([["group:src", { label: "src zone" }]]) as Map<
      string,
      { label: string }
    >;

    const result = await analysisMapper.buildTopFindings(
      findings,
      files,
      zoneLabels,
      "ivan",
      "doxynix",
    );

    expect(result.map((item) => item.id)).toEqual([
      "src/b.ts:2:performance:1",
      "src/a.ts:10:security:0",
    ]);
    expect(result[0]).toMatchObject({
      messageHtml: "<p>high</p>",
      nodeId: null,
      riskLevel: 9,
      zoneId: null,
      zoneLabel: null,
    });
    expect(result[1]).toMatchObject({
      messageHtml: "<p>low</p>",
      nodeId: "file:src/a.ts",
      zoneLabel: "src zone",
    });
    expect(mocks.markdownToHtml).toHaveBeenCalledWith({
      content: "high",
      name: "doxynix",
      owner: "ivan",
    });
    expect(mocks.unstable_cache).toHaveBeenCalledWith(
      expect.any(Function),
      [expect.stringContaining("finding-html-ivan-doxynix-src/b.ts:2")],
      expect.objectContaining({
        revalidate: false,
        tags: ["findings", "ivan", "doxynix", "src/b.ts:2:performance:1"],
      }),
    );
  });

  it("missing score → riskLevel 0; zoneLabel falls back to file.zoneLabel", async () => {
    const findings = [makeFinding({ file: "src/a.ts", score: undefined })];
    const files = [
      makeChangedFile({ filePath: "src/a.ts", zoneId: "group:src", zoneLabel: "src" }),
    ];

    const result = await analysisMapper.buildTopFindings(findings, files, new Map());

    expect(result[0]).toMatchObject({ riskLevel: 0, zoneLabel: "src" });
  });
});

describe("toAvailableDocs", () => {
  it("deduplicates documents and builds summary with writer statuses", () => {
    const aiResult = makeAiResult();
    const repo = makeRepoFact({
      analyses: [makeAnalysis(aiResult)],
      documents: [
        makeDoc({ path: "README.md", publicId: "d-readme", type: "README" }),
        makeDoc({ path: "docs/api.md", publicId: "d-api", type: "API" }),
      ],
    });

    const result = analysisMapper.toAvailableDocs(repo);

    expect(result.map((item) => item.id)).toEqual(["d-readme", "d-api"]);
    expect(result[0]).toMatchObject({ source: null, status: "missing" });
    expect(result[1]).toMatchObject({ source: "llm", status: "llm", type: "API" });
  });
});

describe("toBriefPanelInput / toInteractiveBriefNodePayloadInput / toExplainBase / toStructureNodeBase", () => {
  it("passes explain/structureNode through the base mappers", () => {
    const explain = makeExplain();
    const structureNode = makeStructureNode();

    const brief = analysisMapper.toBriefPanelInput({ explain, structureNode });
    expect(brief.explain).toEqual(analysisMapper.toExplainBase(explain));
    expect(brief.structureNode).toEqual(analysisMapper.toStructureNodeBase(structureNode));
    expect(brief.structureNode.breadcrumbs).toEqual([{ id: "b1", label: "src", path: "src" }]);
  });

  it("interactive variant injects null analysisRef when absent", () => {
    const input = analysisMapper.toInteractiveBriefNodePayloadInput({
      explain: makeExplain(),
      structureNode: makeStructureNode(),
    });
    expect(input.explain.analysisRef).toBeNull();
    expect(input.structureNode.analysisRef).toBeNull();
    expect(input.explain.confidence).toBe("high");
  });
});

describe("toDetailedMetrics", () => {
  it("maps the whole payload with nullable defaults", () => {
    const aiResult = makeAiResult();
    const metrics = makeMetrics({ dependencyCycles: [["a", "b"]] });
    const analysis = makeAnalysis(aiResult, metrics);

    const result = analysisMapper.toDetailedMetrics(analysis);

    expect(result).not.toBeNull();
    expect(result?.security).toMatchObject({
      findings: [],
      risks: ["risk"],
      score: 5,
      securityScanStatus: "ok",
      vulnerabilities: [],
    });
    expect(result?.quality).toMatchObject({ dependencyCycles: 1, docDensity: 0 });
    expect(result?.onboarding).toEqual({
      guide: { prerequisites: [], setup_steps: [] },
      score: 0,
      teamRoles: [],
    });
    expect(result?.domain.analysis).toEqual(aiResult.domain_analysis);
    expect(result?.reference.swagger).toBe("openapi: 3.0.0");
    expect(result?.risks.topRisks).toEqual([]);
  });

  it("missing optional fields → null/[] per code, empty analysis → null", () => {
    const metrics = makeMetrics();
    delete (metrics as { graphReliability?: unknown }).graphReliability;
    delete (metrics as { hotspotSignals?: unknown }).hotspotSignals;
    delete (metrics as { routeInventory?: unknown }).routeInventory;
    const aiResult = makeAiResult({
      mainBottlenecks: undefined,
      swaggerYaml: undefined,
      vulnerabilities: undefined,
    });
    const result = analysisMapper.toDetailedMetrics(makeAnalysis(aiResult, metrics));

    expect(result?.architecture.graphReliability).toBeNull();
    expect(result?.architecture.hotspotSignals).toEqual([]);
    expect(result?.architecture.routeInventory).toBeNull();
    expect(result?.recommendations.bottlenecks).toEqual([]);
    expect(result?.reference.swagger).toBeNull();
    expect(result?.security.vulnerabilities).toEqual([]);
    expect(analysisMapper.toDetailedMetrics(null)).toBeNull();
  });
});

describe("toOverview", () => {
  it("maps repo, docs, scores, and summary with key_innovations padding", () => {
    const aiResult = makeAiResult();
    const metrics = makeMetrics({ totalSizeKb: 512 });
    const repo = makeRepoFact({
      analyses: [makeAnalysis(aiResult, metrics)],
      documents: [makeDoc({ path: "README.md", publicId: "d-readme", type: "README" })],
    });

    const result = analysisMapper.toOverview(repo);

    expect(result).not.toBeNull();
    expect(result?.repo).toMatchObject({
      defaultBranch: "main",
      description: "A repo",
      id: "repo-1",
      language: "TypeScript",
      languageColor: "#cccccc",
      license: "MIT",
      name: "doxynix",
      visibility: "public",
    });
    expect(mocks.getLanguageColor).toHaveBeenCalledWith("TypeScript");
    expect(result?.docs).toMatchObject({
      availableCount: 1,
      availableTypes: ["README"],
      hasSwagger: true,
      writers: {
        api: "llm",
        architecture: "missing",
        changelog: "failed",
        contributing: "llm",
        readme: "missing",
      },
    });
    expect(mocks.hasText).toHaveBeenCalledWith(aiResult.swaggerYaml);
    expect(result?.stats).toMatchObject({ totalSizeKb: 512, totalSizeLabel: "512 KB" });
    expect(result?.summary).toEqual({
      architecture_style: "Layered",
      key_innovations: [],
      purpose: "purpose",
      stack_details: ["TypeScript"],
    });
  });

  it("keeps key_innovations from LLM; no analysis → null", () => {
    const repo = makeRepoFact({
      analyses: [
        makeAnalysis(
          makeAiResult({
            executive_summary: {
              architecture_style: "Hexagonal",
              key_innovations: ["innov"],
              purpose: "p",
              stack_details: [],
            },
          }),
        ),
      ],
    });
    expect(analysisMapper.toOverview(repo)?.summary.key_innovations).toEqual(["innov"]);
    expect(analysisMapper.toOverview(makeRepoFact())).toBeNull();
  });
});
