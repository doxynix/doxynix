import { beforeEach, describe, expect, it, vi } from "vitest";

import { REALTIME_CONFIG } from "@/shared/config/realtime";

// ---------------------------------------------------------------------------
// Hoisted mocks — declared BEFORE any source imports
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  publish: vi.fn(),
  redisSet: vi.fn(),
  runDocumentFilePreview: vi.fn(),
  task: vi.fn((def: unknown) => def),
  toDocumentFilePreview: vi.fn((x: unknown) => x),
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
  redisClient: { set: mocks.redisSet },
}));

vi.mock("@/server/utils/task-config", () => ({
  TASK_CONFIGS: { documentSingleFile: {} },
}));

vi.mock("../analysis.service", () => ({
  repoAnalysisService: { runDocumentFilePreview: mocks.runDocumentFilePreview },
}));

vi.mock("../logic/repo-file-action-preview", () => ({
  toDocumentFilePreview: mocks.toDocumentFilePreview,
}));

import { documentFileTask } from "./document-file.task";

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

const previewResult = {
  analysisRef: null,
  confidence: "high",
  consistency: "matched",
  consistencyNote: null,
  documentation: "generated docs",
  path: "src/a.ts",
  summary: "Documentation summary",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("documentFileTask", () => {
  it("registers the document-single-file Trigger task", () => {
    expect(registeredTaskDefs).toContainEqual(
      expect.objectContaining({ id: "document-single-file" }),
    );
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.runDocumentFilePreview.mockResolvedValue(previewResult);
    mocks.redisSet.mockResolvedValue(undefined);
  });

  it("runs the documentation preview, caches it, and publishes the event", async () => {
    const result = await runTask(documentFileTask)(payload);

    expect(mocks.runDocumentFilePreview).toHaveBeenCalledWith(1, payload);
    expect(mocks.toDocumentFilePreview).toHaveBeenCalledWith({
      ...previewResult,
      ...syncMeta,
    });
    expect(mocks.redisSet).toHaveBeenCalledWith(
      "file-result:1:document-file-preview:src/a.ts",
      result,
      { ex: 86_400 },
    );
    expect(mocks.publish).toHaveBeenCalledWith(REALTIME_CONFIG.events.user.fileActionCompleted, {
      path: "src/a.ts",
      type: "DOCUMENTATION",
    });
  });

  it("returns the merged preview result", async () => {
    const result = await runTask(documentFileTask)(payload);

    expect(result).toEqual({ ...previewResult, ...syncMeta });
    expect(result).toMatchObject({ documentation: "generated docs", path: "src/a.ts" });
  });
});
