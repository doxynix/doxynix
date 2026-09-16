import { PRAnalysisStatus } from "@doxynix/shared";
import { TRPCError } from "@trpc/server";
import { describe, expect, it, vi } from "vitest";

import type { DbClient } from "@/server/core/db";
import type { PRChangedFileSnapshot } from "@/server/utils/types";

import {
  analysisRepo,
  latestCompletedAnalysisSelect,
  repoWithLatestAnalysisAndDocsSelect,
} from "./analysis.repository";

// analysis.utils pulls in heavy AI modules — mock it here.
const mocks = vi.hoisted(() => ({
  pickLatestDocsByType: vi.fn((docs: unknown[]) => docs),
}));
vi.mock("./analysis.utils", () => ({ pickLatestDocsByType: mocks.pickLatestDocsByType }));

const REPO_ID = "repo-pub-1";
const PR_PUB = "pr-pub-1";
type Fn = ReturnType<typeof vi.fn>;
const fn = (res?: unknown): Fn => vi.fn().mockResolvedValue(res);

function makeDb(overrides: Record<string, unknown> = {}): DbClient {
  return {
    analysis: { findFirst: fn() },
    document: { findMany: fn() },
    generatedFix: { create: fn(), findMany: fn(), findUnique: fn(), update: fn() },
    pullRequestAnalysis: { create: fn(), findFirst: fn(), update: fn() },
    pullRequestComment: { createMany: fn(), findMany: fn() },
    repo: { findUnique: fn() },
    ...overrides,
  } as unknown as DbClient;
}

function stub(db: DbClient, path: string, res?: unknown): Fn {
  const [model = "", method = ""] = path.split(".");
  const spy = fn(res);
  (db as unknown as Record<string, Record<string, Fn>>)[model]![method] = spy;
  return spy;
}

/** Assert the spy was called once and return the first call argument. */
function calledWith(spy: Fn) {
  expect(spy).toHaveBeenCalledOnce();
  return spy.mock.calls[0]![0] as Record<string, unknown>;
}

// --- Shared fixture data ---------------------------------------------------
const PR_CREATE_INPUT = {
  baseSha: "aaa",
  headSha: "bbb",
  owner: "org",
  prNumber: 7,
  repoId: REPO_ID,
  repoName: "repo",
};

describe("analysisRepo", () => {
  it("addComments: calls pullRequestComment.createMany with mapped data", async () => {
    const db = makeDb();
    const spy = stub(db, "pullRequestComment.createMany", { count: 2 });
    const comments = [
      { body: "b1", filePath: "a.ts", findingType: "bug", line: 10, riskLevel: 5 },
      { body: "b2", filePath: "b.ts", findingType: "style", line: 20, riskLevel: 1 },
    ];
    await expect(analysisRepo.addComments(db, 42, comments)).resolves.toEqual({ count: 2 });
    expect(spy).toHaveBeenCalledWith({ data: comments.map((c) => ({ analysisId: 42, ...c })) });
  });

  it("create: defaults createdByUser and omits prAnalysis when absent", async () => {
    const db = makeDb();
    const spy = stub(db, "generatedFix.create", { publicId: "fix-1" });
    await analysisRepo.create(db, { branch: "main", repoId: REPO_ID, title: "Fix X" });
    const arg = calledWith(spy);
    expect(arg.data).toEqual(
      expect.objectContaining({
        branch: "main",
        createdByUser: false,
        status: "DRAFT",
        title: "Fix X",
      }),
    );
    expect(arg.data).not.toHaveProperty("prAnalysis");
  });

  it("create: connects prAnalysis and forwards explicit fields", async () => {
    const db = makeDb();
    const spy = stub(db, "generatedFix.create", { publicId: "fix-2" });
    await analysisRepo.create(db, {
      branch: "feat",
      createdByUser: true,
      description: "desc",
      prAnalysisId: PR_PUB,
      repoId: REPO_ID,
      title: "Fix Y",
    });
    expect(calledWith(spy).data).toEqual(
      expect.objectContaining({
        createdByUser: true,
        description: "desc",
        prAnalysis: { connect: { publicId: PR_PUB } },
      }),
    );
  });

  it("createPRAnalysis: creates with PENDING status and correct data", async () => {
    const db = makeDb();
    const spy = stub(db, "pullRequestAnalysis.create", { publicId: PR_PUB });
    await analysisRepo.createPRAnalysis(db, PR_CREATE_INPUT);
    expect(calledWith(spy).data).toEqual({
      baseSha: "aaa",
      headSha: "bbb",
      owner: "org",
      prNumber: 7,
      repo: { connect: { publicId: REPO_ID } },
      repoName: "repo",
      status: PRAnalysisStatus.PENDING,
    });
  });

  it.each([
    { name: "returns the fix when found", res: { publicId: "f1" } },
    { name: "returns null when missing", res: null },
  ])("getById: $name", async ({ res }) => {
    const db = makeDb();
    stub(db, "generatedFix.findUnique", res);
    await expect(analysisRepo.getById(db, "x")).resolves.toBe(res);
    expect(db.generatedFix.findUnique).toHaveBeenCalledWith({ where: { publicId: "x" } });
  });

  it("getByRepoAndPRNumber: queries with include and correct where", async () => {
    const db = makeDb();
    const spy = stub(db, "pullRequestAnalysis.findFirst", { publicId: PR_PUB });
    await expect(analysisRepo.getByRepoAndPRNumber(db, REPO_ID, 3)).resolves.toEqual({
      publicId: PR_PUB,
    });
    expect(calledWith(spy)).toEqual({
      include: { comments: true, generatedFixes: true },
      orderBy: { createdAt: "desc" },
      where: { prNumber: 3, repo: { publicId: REPO_ID } },
    });
  });

  it("getByRepoAndPRNumber: returns null when no match", async () => {
    const db = makeDb();
    stub(db, "pullRequestAnalysis.findFirst", null);
    await expect(analysisRepo.getByRepoAndPRNumber(db, REPO_ID, 99)).resolves.toBeNull();
  });

  it.each([
    {
      expectedWhere: { repo: { publicId: REPO_ID } },
      name: "omits status when undefined",
      status: undefined,
    },
    {
      expectedWhere: { repo: { publicId: REPO_ID }, status: "COMPLETED" },
      name: "adds status filter when provided",
      status: "COMPLETED" as const,
    },
  ])("getByRepoId: $name", async ({ status, expectedWhere }) => {
    const db = makeDb();
    const spy = stub(db, "generatedFix.findMany", []);
    await analysisRepo.getByRepoId(db, REPO_ID, status);
    expect(calledWith(spy)).toEqual({ orderBy: { createdAt: "desc" }, where: expectedWhere });
  });

  it("getLatestRef: maps the found analysis to AnalysisRef", async () => {
    const db = makeDb();
    stub(db, "analysis.findFirst", {
      commitSha: "sha-1",
      createdAt: new Date("2025-01-01"),
      publicId: "a1",
    });
    await expect(analysisRepo.getLatestRef(db, REPO_ID)).resolves.toEqual({
      analysisId: "a1",
      commitSha: "sha-1",
      createdAt: new Date("2025-01-01"),
    });
    expect(db.analysis.findFirst).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
      select: { commitSha: true, createdAt: true, publicId: true },
      where: { repo: { publicId: REPO_ID }, status: "DONE" },
    });
  });

  it("getLatestRef: returns null when no DONE analysis exists", async () => {
    const db = makeDb();
    stub(db, "analysis.findFirst", null);
    await expect(analysisRepo.getLatestRef(db, REPO_ID)).resolves.toBeNull();
  });

  it("getRepoBySha: scopes analyses to the given commitSha and DONE status", async () => {
    const db = makeDb();
    const spy = stub(db, "repo.findUnique", { publicId: REPO_ID });
    await expect(analysisRepo.getRepoBySha(db, REPO_ID, "sha-abc")).resolves.toEqual({
      publicId: REPO_ID,
    });
    const arg = calledWith(spy);
    expect(arg.where).toEqual({ publicId: REPO_ID });
    expect((arg.select as { analyses: unknown }).analyses).toEqual(
      expect.objectContaining({ where: { commitSha: "sha-abc", status: "DONE" } }),
    );
  });

  it("getRepoBySha: returns null when repo is missing", async () => {
    const db = makeDb();
    stub(db, "repo.findUnique", null);
    await expect(analysisRepo.getRepoBySha(db, "x", "y")).resolves.toBeNull();
  });

  it("getRepoSnapshot: returns the repo when it has analyses (no aid)", async () => {
    const db = makeDb();
    const repo = { analyses: [{ publicId: "a1" }], documents: [] };
    stub(db, "repo.findUnique", repo);
    await expect(analysisRepo.getRepoSnapshot(db, REPO_ID)).resolves.toBe(repo);
  });

  it("getRepoSnapshot: returns null when repo is missing", async () => {
    const db = makeDb();
    stub(db, "repo.findUnique", null);
    await expect(analysisRepo.getRepoSnapshot(db, REPO_ID)).resolves.toBeNull();
  });

  it("getRepoSnapshot: throws NOT_FOUND when no completed analyses exist", async () => {
    const db = makeDb();
    stub(db, "repo.findUnique", { analyses: [], documents: [] });
    const promise = analysisRepo.getRepoSnapshot(db, REPO_ID);
    await expect(promise).rejects.toBeInstanceOf(TRPCError);
    await expect(promise).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("getRepoSnapshot: filters documents by aid and replaces analyses", async () => {
    const db = makeDb();
    stub(db, "repo.findUnique", {
      analyses: [{ publicId: "a1" }],
      documents: [
        { analysis: { publicId: "a2" }, path: "a.md" },
        { analysis: { publicId: "a1" }, path: "b.md" },
      ],
    });
    stub(db, "analysis.findFirst", { publicId: "a2" });
    const result = await analysisRepo.getRepoSnapshot(db, REPO_ID, "a2");
    expect(result).toEqual({
      analyses: [{ publicId: "a2" }],
      documents: [{ analysis: { publicId: "a2" }, path: "a.md" }],
    });
  });

  it("getRepoSnapshot: throws NOT_FOUND when target analysis version is missing", async () => {
    const db = makeDb();
    stub(db, "repo.findUnique", { analyses: [], documents: [] });
    stub(db, "analysis.findFirst", null);
    const promise = analysisRepo.getRepoSnapshot(db, REPO_ID, "missing");
    await expect(promise).rejects.toBeInstanceOf(TRPCError);
    await expect(promise).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it.each([
    { name: "returns the analysis when found", res: { prNumber: 5, publicId: PR_PUB } },
    { name: "returns null when no match", res: null },
  ])("loadImpactAnalysis: $name", async ({ res }) => {
    const db = makeDb();
    stub(db, "pullRequestAnalysis.findFirst", res);
    await expect(analysisRepo.loadImpactAnalysis(db, REPO_ID, 5)).resolves.toBe(res);
    expect(db.pullRequestAnalysis.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { prNumber: 5, repo: { publicId: REPO_ID } } }),
    );
  });

  it("loadLatestDocumentsWithContent: delegates to pickLatestDocsByType", async () => {
    const db = makeDb();
    const docs = [{ publicId: "d1" }];
    stub(db, "document.findMany", docs);
    mocks.pickLatestDocsByType.mockReturnValueOnce([docs[0]]);
    await expect(analysisRepo.loadLatestDocumentsWithContent(db, REPO_ID)).resolves.toEqual([
      docs[0],
    ]);
    expect(mocks.pickLatestDocsByType).toHaveBeenCalledWith(docs);
  });

  it.each([
    {
      aid: undefined as string | undefined,
      expectedWhere: { repo: { publicId: REPO_ID } },
      name: "omits aid filter when absent",
    },
    {
      aid: "a1",
      expectedWhere: { analysis: { publicId: "a1" }, repo: { publicId: REPO_ID } },
      name: "adds aid filter when provided",
    },
  ])("loadLatestDocumentsWithContent: $name", async ({ aid, expectedWhere }) => {
    const db = makeDb();
    const spy = stub(db, "document.findMany", []);
    await analysisRepo.loadLatestDocumentsWithContent(db, REPO_ID, aid);
    expect(calledWith(spy).where).toEqual(expectedWhere);
  });

  it("loadRelatedFixes: returns [] before hitting the db for empty ids", async () => {
    const db = makeDb();
    await expect(analysisRepo.loadRelatedFixes(db, [])).resolves.toEqual([]);
    await expect(analysisRepo.loadRelatedFixes(db, [""])).resolves.toEqual([]);
    expect(db.generatedFix.findMany).not.toHaveBeenCalled();
  });

  it("loadRelatedFixes: deduplicates ids and maps the fixes", async () => {
    const db = makeDb();
    const spy = stub(db, "generatedFix.findMany", [
      { githubPrNumber: 1, githubPrUrl: "url1", publicId: "f1", status: "DRAFT", title: "t1" },
      { githubPrNumber: null, githubPrUrl: null, publicId: "f2", status: "COMPLETED", title: "t2" },
    ]);
    const result = await analysisRepo.loadRelatedFixes(db, ["a1", "a1", "a2"]);
    expect(result).toEqual([
      { githubPrNumber: 1, githubPrUrl: "url1", id: "f1", status: "DRAFT", title: "t1" },
      { githubPrNumber: null, githubPrUrl: null, id: "f2", status: "COMPLETED", title: "t2" },
    ]);
    const arg = calledWith(spy);
    expect(arg.take).toBe(8);
    expect(
      (arg.where as { prAnalysis: { publicId: { in: unknown } } }).prAnalysis.publicId.in,
    ).toEqual(["a1", "a2"]);
  });

  it("loadRelatedPrFindings: returns [] for empty relatedFiles", async () => {
    const db = makeDb();
    await expect(analysisRepo.loadRelatedPrFindings(db, REPO_ID, [])).resolves.toEqual([]);
    expect(db.pullRequestComment.findMany).not.toHaveBeenCalled();
  });

  it("loadRelatedPrFindings: queries and maps matching comments", async () => {
    const db = makeDb();
    const spy = stub(db, "pullRequestComment.findMany", [
      {
        analysis: { prNumber: 7, publicId: "a1" },
        body: "issue",
        filePath: "x.ts",
        findingType: "bug",
        line: 5,
        publicId: "c1",
        riskLevel: 8,
      },
    ]);
    const result = await analysisRepo.loadRelatedPrFindings(db, REPO_ID, ["x.ts"]);
    expect(result).toEqual([
      {
        body: "issue",
        filePath: "x.ts",
        findingType: "bug",
        id: "c1",
        line: 5,
        prAnalysisId: "a1",
        prNumber: 7,
        riskLevel: 8,
      },
    ]);
    const arg = calledWith(spy);
    expect(arg.take).toBe(12);
    expect(arg.where).toEqual({
      analysis: { repo: { publicId: REPO_ID } },
      filePath: { in: ["x.ts"] },
    });
  });

  it("storeChangedFilesSnapshot: updates with changedFilesJson", async () => {
    const db = makeDb();
    const spy = stub(db, "pullRequestAnalysis.update", { id: 1 });
    const files: PRChangedFileSnapshot[] = [
      { additions: 10, deletions: 2, filePath: "a.ts", previousFilePath: null, status: "modified" },
    ];
    await analysisRepo.storeChangedFilesSnapshot(db, 1, files);
    expect(calledWith(spy)).toEqual({ data: { changedFilesJson: files }, where: { id: 1 } });
  });

  it.each([
    { name: "updates only baseSha", payload: { baseSha: "x" } },
    { name: "updates only headSha", payload: { headSha: "y" } },
    { name: "updates both when both provided", payload: { baseSha: "a", headSha: "b" } },
  ])("updatePRAnalysis: $name", async ({ payload }) => {
    const db = makeDb();
    const spy = stub(db, "pullRequestAnalysis.update", {});
    await analysisRepo.updatePRAnalysis(db, 2, payload);
    expect(calledWith(spy)).toEqual({ data: payload, where: { id: 2 } });
  });

  it("updatePRAnalysisStatus: sets status without optional data", async () => {
    const db = makeDb();
    const spy = stub(db, "pullRequestAnalysis.update", {});
    await analysisRepo.updatePRAnalysisStatus(db, 1, PRAnalysisStatus.COMPLETED);
    expect(calledWith(spy).data).toEqual({
      error: undefined,
      findingsJson: undefined,
      riskScore: undefined,
      status: PRAnalysisStatus.COMPLETED,
    });
  });

  it("updatePRAnalysisStatus: forwards error, findingsJson, and riskScore", async () => {
    const db = makeDb();
    const spy = stub(db, "pullRequestAnalysis.update", {});
    await analysisRepo.updatePRAnalysisStatus(db, 3, PRAnalysisStatus.FAILED, {
      error: "timeout",
      findingsJson: { ok: false },
      riskScore: 9,
    });
    expect(calledWith(spy).data).toEqual({
      error: "timeout",
      findingsJson: { ok: false },
      riskScore: 9,
      status: PRAnalysisStatus.FAILED,
    });
  });

  it.each([
    {
      data: undefined,
      expected: { estimatedImpact: undefined, githubPrNumber: undefined, githubPrUrl: undefined },
      name: "omits optional fields → undefined",
    },
    {
      data: { estimatedImpact: 5, githubPrNumber: 42, githubPrUrl: "https://pr/42" },
      expected: { estimatedImpact: 5, githubPrNumber: 42, githubPrUrl: "https://pr/42" },
      name: "forwards all optional fields",
    },
  ])("updateStatus: $name", async ({ data, expected }) => {
    const db = makeDb();
    const spy = stub(db, "generatedFix.update", {});
    await analysisRepo.updateStatus(db, "fix-1", "COMPLETED", data);
    expect(calledWith(spy)).toEqual({
      data: { ...expected, status: "COMPLETED" },
      where: { publicId: "fix-1" },
    });
  });

  it("latestCompletedAnalysisSelect has the expected fields", () => {
    expect(Object.keys(latestCompletedAnalysisSelect).sort()).toEqual([
      "commitSha",
      "complexityScore",
      "createdAt",
      "metricsJson",
      "onboardingScore",
      "publicId",
      "resultJson",
      "score",
      "securityScore",
      "status",
      "techDebtScore",
    ]);
  });

  it("repoWithLatestAnalysisAndDocsSelect nests analyses and documents selects", () => {
    expect(repoWithLatestAnalysisAndDocsSelect.analyses).toEqual(
      expect.objectContaining({ take: 1, where: { status: "DONE" } }),
    );
    expect(repoWithLatestAnalysisAndDocsSelect.documents.select).toEqual(
      expect.objectContaining({ publicId: true, type: true, version: true }),
    );
  });
});
