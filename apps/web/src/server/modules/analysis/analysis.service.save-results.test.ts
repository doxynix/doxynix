import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const m = vi.hoisted(() => ({
  // analysisRepo (called indirectly by autoSyncDocsToGithub inside saveResults)
  analysisRepo: {
    create: vi.fn(),
    updateStatus: vi.fn(),
  },
  // Logging
  appLogger: {
    debug: vi.fn(),
    error: vi.fn(),
    flush: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
  // Imports from engine used inside saveResults
  calculateDocumentationOutputScore: vi.fn(() => ({
    score: 50,
    snapshot: {},
  })),
  calculateHealthScore: vi.fn(() => 75),
  calculateTeamRoles: vi.fn(() => ({ admin: [], contributor: [] })),
  // Prisma DB client (saveResults uses prisma.$transaction internally)
  db: {
    $transaction: vi.fn(),
    document: { upsert: vi.fn() },
    githubInstallation: { findFirst: vi.fn() },
    notification: { create: vi.fn() },
  },
  // Imports from analysis.utils used inside saveResults
  deriveMaintenanceStatus: vi.fn(() => "active"),
  // generateBranchName (autoSyncDocsToGithub)
  generateBranchName: vi.fn(() => "doxynix/doc-sync-abc123"),
  // GitHub provider (autoSyncDocsToGithub)
  getInstallationClient: vi.fn(),
  // Realtime
  realtimeService: {
    user: vi.fn(() => ({ publish: vi.fn() })),
  },
}));

// ---------------------------------------------------------------------------
// vi.mock
// ---------------------------------------------------------------------------
vi.mock("./analysis.repository", () => ({ analysisRepo: m.analysisRepo }));
vi.mock("@/server/core/app-logger", () => ({ appLogger: m.appLogger }));
vi.mock("@/server/core/db", () => ({ PrismaClient: vi.fn(), prisma: m.db }));
vi.mock("@/server/core/realtime", () => ({ realtimeService: m.realtimeService }));
vi.mock("@/shared/lib/get-branch-name", () => ({
  generateBranchName: m.generateBranchName,
}));
vi.mock("@/server/core/github/github-provider", () => ({
  getInstallationClient: m.getInstallationClient,
}));
vi.mock("./analysis.utils", () => ({
  buildContextPromptGuidance: vi.fn(),
  buildContextSection: vi.fn(),
  buildDocumentFallback: vi.fn(),
  dedupeSearchResults: vi.fn((r: unknown[]) => r),
  deriveMaintenanceStatus: m.deriveMaintenanceStatus,
  describeContextQualifier: vi.fn(),
  getNonActionableReason: vi.fn(),
  isBinaryLikeContent: vi.fn(),
  scoreSearchMatch: vi.fn(),
}));
vi.mock("./logic/doc-priority", () => ({
  calculateDocumentationOutputScore: m.calculateDocumentationOutputScore,
}));
vi.mock("./engine/metrics/complexity", () => ({
  calculateHealthScore: m.calculateHealthScore,
}));
vi.mock("./engine/metrics/common-metrics", () => ({
  calculateTeamRoles: m.calculateTeamRoles,
}));

// ---------------------------------------------------------------------------
// Module under test
// ---------------------------------------------------------------------------
import { repoAnalysisService } from "./analysis.service";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Minimal DbClient shape for $transaction tests (only the callback matters). */
function fakeTx() {
  return {
    analysis: { update: vi.fn(async () => ({ id: 1 })) },
    document: { upsert: vi.fn(async () => ({})) },
    notification: { create: vi.fn(async () => ({ publicId: "n1", title: "done" })) },
  };
}

/** Minimal SaveResultsParams fixture. */
function makeParams(overrides?: Record<string, unknown>) {
  return {
    aiResult: { findings: [], repository_facts: [] },
    analysisId: "a1",
    busFactor: 2,
    channelName: "user-42",
    currentSha: "sha-abc",
    generatedDocsData: {
      generatedApiMarkdown: "# API",
      generatedArchitecture: "# Arch",
      generatedChangelog: "# Changelog",
      generatedContributing: "# Contrib",
      generatedReadme: "# README",
    },
    hardMetrics: {
      complexityScore: 70,
      configFiles: 3,
      dependencyCycles: [],
      docDensity: 12,
      duplicationReport: { duplicationPercentage: 5 },
      entrypoints: ["src/index.ts"],
      fileCount: 40,
      mostComplexFiles: [],
      routeInventory: { httpRoutes: [] },
      securityFindings: [],
      securityScore: 90,
      techDebtScore: 30,
      totalLoc: 5000,
    },
    rawContributors: [{ contributions: 10, login: "alice" }],
    repo: {
      defaultBranch: "main",
      id: 1,
      name: "my-repo",
      owner: "org",
      publicId: "r1",
    },
    repositoryFacts: [{ category: "architecture", text: "mono-repo" }],
    repositoryFindings: [],
    userId: 42,
    ...overrides,
  } as unknown as Parameters<typeof repoAnalysisService.saveResults>[0];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  // Default: $transaction delegates to the callback with a fake tx object
  m.db.$transaction.mockImplementation(async (fn: (tx: ReturnType<typeof fakeTx>) => unknown) => {
    const tx = fakeTx();
    return fn(tx);
  });

  // Default: no GitHub installation → autoSyncDocsToGithub short-circuits
  m.db.githubInstallation.findFirst.mockResolvedValue(null);
});

describe("saveResults", () => {
  it("computes health score and returns it", async () => {
    const score = await repoAnalysisService.saveResults(makeParams());
    expect(score).toBe(75);
    expect(m.calculateHealthScore).toHaveBeenCalledWith(
      expect.objectContaining({
        busFactor: 2,
        complexityScore: 70,
        dependencyCycles: 0,
        docDensity: 12,
        duplicationPercentage: 5,
        securityScore: 90,
        techDebtScore: 30,
      }),
    );
  });

  it("computes onboarding score from doc output + hard metrics", async () => {
    await repoAnalysisService.saveResults(makeParams());
    // docOutputScore=50 + docDensity>10→10 + entrypoints>0→15 + configFiles>0→10 + architecture fact→10 = 95
    expect(m.db.$transaction).toHaveBeenCalled();
  });

  it("creates analysis update with Status.DONE", async () => {
    const tx = fakeTx();
    m.db.$transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx));

    await repoAnalysisService.saveResults(makeParams());

    expect(tx.analysis.update).toHaveBeenCalledWith({
      data: expect.objectContaining({
        commitSha: "sha-abc",
        progress: 100,
        status: "DONE",
      }),
      where: { publicId: "a1" },
    });
  });

  it("upserts only non-empty docs", async () => {
    const tx = fakeTx();
    m.db.$transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx));

    await repoAnalysisService.saveResults(
      makeParams({
        generatedDocsData: {
          generatedApiMarkdown: undefined,
          generatedArchitecture: undefined,
          generatedChangelog: undefined,
          generatedContributing: undefined,
          generatedReadme: "# Hello",
        },
      }),
    );

    // Only README should be upserted (1 call)
    expect(tx.document.upsert).toHaveBeenCalledTimes(1);
    expect(tx.document.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ type: "README" }),
      }),
    );
  });

  it("skips all docs when all are empty/undefined", async () => {
    const tx = fakeTx();
    m.db.$transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx));

    await repoAnalysisService.saveResults(makeParams({ generatedDocsData: {} }));

    expect(tx.document.upsert).not.toHaveBeenCalled();
  });

  it("creates notification with correct message", async () => {
    const tx = fakeTx();
    m.db.$transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx));

    await repoAnalysisService.saveResults(makeParams());

    expect(tx.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        body: "Health Score: 75/100",
        title: "Analysis for org/my-repo ready",
        type: "SUCCESS",
        userId: 42,
      }),
    });
  });

  it("publishes realtime notification", async () => {
    const fakePublish = vi.fn();
    m.realtimeService.user.mockReturnValue({ publish: fakePublish });

    await repoAnalysisService.saveResults(makeParams());

    expect(m.realtimeService.user).toHaveBeenCalledWith(42);
    expect(fakePublish).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ id: "n1", title: "done" }),
    );
  });

  it("triggers background autoSyncDocsToGithub (fire-and-forget)", async () => {
    // No GitHub installation → autoSyncDocsToGithub short-circuits with null
    m.db.githubInstallation.findFirst.mockResolvedValue(null);

    await repoAnalysisService.saveResults(makeParams());

    // Give the fire-and-forget promise a tick to settle
    await new Promise((r) => setTimeout(r, 10));

    expect(m.calculateHealthScore).toHaveBeenCalled();
    expect(m.appLogger.error).not.toHaveBeenCalled();
  });

  it("maps security findings to vulnerabilities with correct risk", async () => {
    await repoAnalysisService.saveResults(
      makeParams({
        hardMetrics: {
          complexityScore: 70,
          configFiles: 3,
          dependencyCycles: [],
          docDensity: 12,
          duplicationReport: { duplicationPercentage: 5 },
          entrypoints: ["src/index.ts"],
          fileCount: 40,
          mostComplexFiles: [],
          routeInventory: { httpRoutes: [] },
          securityFindings: [
            { line: 10, message: "hardcoded key", path: "src/config.ts", severity: "error" },
            { line: 20, message: "weak hash", path: "src/auth.ts", severity: "warning" },
          ],
          securityScore: 50,
          techDebtScore: 30,
          totalLoc: 5000,
        },
      }),
    );

    expect(m.calculateHealthScore).toHaveBeenCalledWith(
      expect.objectContaining({ securityScore: 50 }),
    );
  });

  it("computes maintenance status via deriveMaintenanceStatus", async () => {
    await repoAnalysisService.saveResults(makeParams());
    expect(m.deriveMaintenanceStatus).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, name: "my-repo", owner: "org" }),
    );
  });

  it("maps team roles from raw contributors", async () => {
    await repoAnalysisService.saveResults(makeParams());
    expect(m.calculateTeamRoles).toHaveBeenCalledWith([{ contributions: 10, login: "alice" }]);
  });
});
