import { beforeEach, describe, expect, it, vi } from "vitest";

import { REALTIME_CONFIG } from "@/shared/config/realtime";

// ---------------------------------------------------------------------------
// Hoisted mocks — declared BEFORE any source imports
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  fileActionsSet: vi.fn(),
  publish: vi.fn(),
  runQuickFileAudit: vi.fn(),
  task: vi.fn((def: unknown) => def),
  toQuickFileAuditPreview: vi.fn((x: unknown) => x),
}));

vi.mock("@trigger.dev/sdk", () => ({
  task: mocks.task,
}));

vi.mock("@/server/core/realtime", () => ({
  realtimeService: {
    user: vi.fn(() => ({ publish: mocks.publish })),
  },
}));

vi.mock("@/server/core/redis", () => ({
  redisService: {
    fileActions: { set: mocks.fileActionsSet },
  },
}));

vi.mock("@/server/utils/task-config", () => ({
  TASK_CONFIGS: { analyzeSingleFile: {} },
}));

vi.mock("../analysis.utils", () => ({
  runQuickFileAudit: mocks.runQuickFileAudit,
}));

vi.mock("../logic/repo-file-action-preview", () => ({
  toQuickFileAuditPreview: mocks.toQuickFileAuditPreview,
}));

import { analyzeFileTask } from "./analyze-file.task";

// The task mock returns the raw definition ({ id, ...run }). Trigger.dev's
// public Task type hides `run`, so reach the handler through `unknown`.
const runTask = (taskDef: unknown): ((...args: unknown[]) => Promise<unknown>) =>
  (taskDef as { run: (...args: unknown[]) => Promise<unknown> }).run;

// Capture task() registration at import time (beforeEach clears call history)
const registeredTaskDefs = mocks.task.mock.calls.map((call) => call[0]);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const syncMeta = {
  analysisRef: null,
  consistency: "unknown" as const,
  consistencyNote: null,
  contentRef: { analysisId: "an-1", commitSha: "sha-1" },
  contextDiagnostics: {
    contextStrength: "none" as const,
    graphNeighborCount: 0,
    hasContext: false,
    neighborPathCount: 0,
    nextSuggestedPathCount: 0,
    nonEmptyBuckets: [],
    recommendedActionCount: 0,
    sourcePathCount: 0,
  },
  contextMeta: {
    confidence: null,
    graphBacked: false,
    mode: "none" as const,
    nodeId: null,
    source: "none" as const,
    title: null,
  },
};

const payload = {
  analysisId: "an-1",
  branch: "main",
  commitSha: "sha-1",
  content: "export const x = 1;",
  language: "typescript",
  path: "src/a.ts",
  repoId: "repo-1",
  syncMeta,
  userId: 1,
};

const auditResult = {
  action: "quick-file-audit",
  analysisRef: null,
  confidence: "high",
  consistency: "matched",
  consistencyNote: null,
  content: "audit markdown",
  contextDiagnostics: syncMeta.contextDiagnostics,
  contextMeta: syncMeta.contextMeta,
  path: "src/a.ts",
  summary: "Audit summary",
  title: "Quick file audit (file-only)",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("analyzeFileTask", () => {
  it("registers the analyze-single-file Trigger task", () => {
    expect(registeredTaskDefs).toContainEqual(
      expect.objectContaining({ id: "analyze-single-file" }),
    );
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.runQuickFileAudit.mockResolvedValue(auditResult);
    mocks.fileActionsSet.mockResolvedValue(undefined);
  });

  it("runs the quick file audit and publishes the completed event", async () => {
    const result = await runTask(analyzeFileTask)(payload);

    expect(mocks.runQuickFileAudit).toHaveBeenCalledWith(1, payload);
    expect(mocks.toQuickFileAuditPreview).toHaveBeenCalledWith({
      ...auditResult,
      ...syncMeta,
    });
    expect(mocks.fileActionsSet).toHaveBeenCalledWith(1, "src/a.ts", "quick-file-audit", result);
    expect(mocks.publish).toHaveBeenCalledWith(REALTIME_CONFIG.events.user.fileActionCompleted, {
      path: "src/a.ts",
      type: "AUDIT",
    });
  });

  it("merges analysisId and commitSha into the returned result", async () => {
    const result = await runTask(analyzeFileTask)(payload);

    expect(result).toMatchObject({
      analysisId: "an-1",
      commitSha: "sha-1",
      path: "src/a.ts",
    });
    expect(result).toEqual({
      ...auditResult,
      ...syncMeta,
      analysisId: "an-1",
      commitSha: "sha-1",
    });
  });
});
