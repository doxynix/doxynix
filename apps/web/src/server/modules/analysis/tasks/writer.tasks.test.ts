import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks — declared BEFORE any source imports
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  executeApiWriter: vi.fn(),
  executeArchitectureWriter: vi.fn(),
  executeChangelogWriter: vi.fn(),
  executeContributingWriter: vi.fn(),
  executeReadmeWriter: vi.fn(),
  runWriterWithLimiter: vi.fn(),
  task: vi.fn((def: unknown) => def),
}));

vi.mock("@trigger.dev/sdk", () => ({
  task: mocks.task,
}));

vi.mock("@/server/utils/task-config", () => ({
  TASK_CONFIGS: { writers: {} },
}));

vi.mock("../ai/writer-runner", () => ({
  runWriterWithLimiter: mocks.runWriterWithLimiter,
}));

vi.mock("../ai/writer-tasks", () => ({
  executeApiWriter: mocks.executeApiWriter,
  executeArchitectureWriter: mocks.executeArchitectureWriter,
  executeChangelogWriter: mocks.executeChangelogWriter,
  executeContributingWriter: mocks.executeContributingWriter,
  executeReadmeWriter: mocks.executeReadmeWriter,
}));

import {
  apiTask,
  architectureTask,
  changelogTask,
  contributingTask,
  readmeTask,
} from "./writer.tasks";

// The task mock returns the raw definition ({ id, ...run }). Trigger.dev's
// public Task type hides `run`, so reach the handler through `unknown`.
const runTask = (taskDef: unknown): ((...args: unknown[]) => Promise<unknown>) =>
  (taskDef as { run: (...args: unknown[]) => Promise<unknown> }).run;

// Capture task() registrations at import time (beforeEach clears call history)
const registeredTaskDefs = mocks.task.mock.calls.map((call) => call[0]);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const writerInput = {
  allowedPaths: "a.ts",
  analysisId: "abc",
  branch: "main",
  context: "ctx",
  engineeringDossierPayload: "{}",
  language: "en",
  payload: "p",
  repoId: "p1",
  selectedTokens: 100,
  userId: 1,
};

const architectureInput = {
  ...writerInput,
  moduleContext: "module-ctx",
  onboardingPayload: "onboarding",
  risksPayload: "risks",
};

const repo = { defaultBranch: "main", publicId: "p1" };
const analysisResult = { findings: [] };

function setupWriterMock() {
  mocks.runWriterWithLimiter.mockImplementation(
    async (name: string, _input: unknown, taskFn: () => Promise<unknown>) => {
      await taskFn();
      return { content: "doc", name, status: "llm" as const };
    },
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("writer.tasks", () => {
  it("registers all five writer tasks with their expected ids", () => {
    expect(registeredTaskDefs).toContainEqual(expect.objectContaining({ id: "write-readme" }));
    expect(registeredTaskDefs).toContainEqual(expect.objectContaining({ id: "write-api" }));
    expect(registeredTaskDefs).toContainEqual(
      expect.objectContaining({ id: "write-architecture" }),
    );
    expect(registeredTaskDefs).toContainEqual(
      expect.objectContaining({ id: "write-contributing" }),
    );
    expect(registeredTaskDefs).toContainEqual(expect.objectContaining({ id: "write-changelog" }));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    for (const fn of [
      mocks.executeApiWriter,
      mocks.executeArchitectureWriter,
      mocks.executeChangelogWriter,
      mocks.executeContributingWriter,
      mocks.executeReadmeWriter,
    ]) {
      fn.mockResolvedValue({ content: "doc", name: "readme", status: "llm" });
    }
    setupWriterMock();
  });

  it("readmeTask runs the readme writer with the full input", async () => {
    const result = await runTask(readmeTask)(writerInput);

    expect(result).toEqual({ content: "doc", name: "readme", status: "llm" });
    expect(mocks.runWriterWithLimiter).toHaveBeenCalledWith(
      "readme",
      writerInput,
      expect.any(Function),
    );
    expect(mocks.executeReadmeWriter).toHaveBeenCalledWith(
      "abc",
      "p",
      "{}",
      "ctx",
      "a.ts",
      "en",
      "p1",
      1,
      "main",
    );
  });

  it("apiTask runs the api writer with the full input", async () => {
    const result = await runTask(apiTask)(writerInput);

    expect(result).toEqual({ content: "doc", name: "api", status: "llm" });
    expect(mocks.runWriterWithLimiter).toHaveBeenCalledWith(
      "api",
      writerInput,
      expect.any(Function),
    );
    expect(mocks.executeApiWriter).toHaveBeenCalledWith(
      "abc",
      "p",
      "{}",
      "ctx",
      "a.ts",
      "en",
      "p1",
      1,
      "main",
    );
  });

  it("architectureTask accepts extra payloads and forwards them in order", async () => {
    const result = await runTask(architectureTask)(architectureInput);

    expect(result).toEqual({ content: "doc", name: "architecture", status: "llm" });
    expect(mocks.runWriterWithLimiter).toHaveBeenCalledWith(
      "architecture",
      architectureInput,
      expect.any(Function),
    );
    expect(mocks.executeArchitectureWriter).toHaveBeenCalledWith(
      "abc",
      "p",
      "risks",
      "onboarding",
      "module-ctx",
      "{}",
      "ctx",
      "a.ts",
      "en",
      "p1",
      1,
      "main",
    );
  });

  it("contributingTask runs the contributing writer with the full input", async () => {
    const result = await runTask(contributingTask)(writerInput);

    expect(result).toEqual({ content: "doc", name: "contributing", status: "llm" });
    expect(mocks.runWriterWithLimiter).toHaveBeenCalledWith(
      "contributing",
      writerInput,
      expect.any(Function),
    );
    expect(mocks.executeContributingWriter).toHaveBeenCalledWith(
      "abc",
      "p",
      "{}",
      "ctx",
      "a.ts",
      "en",
      "p1",
      1,
      "main",
    );
  });

  it("changelogTask builds its input from repo metadata and runs the changelog writer", async () => {
    const input = { analysisId: "abc", analysisResult, language: "en", repo, userId: 1 };

    const result = await runTask(changelogTask)(input);

    expect(result).toEqual({ content: "doc", name: "changelog", status: "llm" });
    expect(mocks.runWriterWithLimiter).toHaveBeenCalledWith(
      "changelog",
      {
        allowedPaths: "",
        analysisId: "abc",
        branch: "main",
        context: "",
        engineeringDossierPayload: "",
        language: "en",
        payload: "",
        repoId: "p1",
        selectedTokens: 25_000,
        userId: 1,
      },
      expect.any(Function),
    );
    expect(mocks.executeChangelogWriter).toHaveBeenCalledWith("abc", analysisResult, 1, repo, "en");
  });
});
