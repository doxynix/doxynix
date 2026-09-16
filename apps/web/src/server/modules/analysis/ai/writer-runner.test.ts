import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks — declared BEFORE any module-under-test imports
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  appLogger: {
    debug: vi.fn(),
    error: vi.fn(),
    flush: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
  schedule: vi.fn(),
}));

vi.mock("@/server/core/app-logger", () => ({ appLogger: mocks.appLogger }));
vi.mock("@/server/utils/llm-limiter", () => ({ llmLimiter: { schedule: mocks.schedule } }));

// WriterName/WriterResult are type-only imports — fully erased at runtime, so
// writer-tasks.ts (which pulls prisma/ai) is never loaded by this test.
import { runWriterWithLimiter, type WriterInput } from "./writer-runner";
import type { WriterName, WriterResult } from "./writer-tasks";

function makeInput(overrides: Partial<WriterInput> = {}): WriterInput {
  return {
    allowedPaths: "src/**",
    analysisId: "abc",
    branch: "main",
    context: "ctx",
    engineeringDossierPayload: "{}",
    language: "English",
    payload: "{}",
    repoId: "repo-1",
    selectedTokens: 25_000,
    userId: 7,
    ...overrides,
  };
}

describe("runWriterWithLimiter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the scheduled writer result on success and reports the estimated weight", async () => {
    const writerResult: WriterResult = { content: "# Docs", name: "readme", status: "llm" };
    mocks.schedule.mockResolvedValue(writerResult);

    const result = await runWriterWithLimiter(
      "readme",
      makeInput({ selectedTokens: 25_000 }),
      async () => writerResult,
    );

    expect(result).toEqual(writerResult);
    expect(mocks.schedule).toHaveBeenCalledWith(
      { id: "abc-readme", weight: Math.ceil(25_000 * 1.3) + 15_000 },
      expect.any(Function),
    );
    expect(mocks.appLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        analysisId: "abc",
        calculatedWeight: Math.ceil(25_000 * 1.3) + 15_000,
        msg: "Running writer README",
        tokens: 25_000,
      }),
    );
    expect(mocks.appLogger.error).not.toHaveBeenCalled();
  });

  it("returns a failed result and logs when the limiter rejects with an Error", async () => {
    mocks.schedule.mockRejectedValue(new Error("exploded"));

    const result = await runWriterWithLimiter("readme", makeInput(), async () => ({
      content: "doc",
      name: "readme",
      status: "llm",
    }));

    expect(result).toEqual({ error: "exploded", name: "readme", status: "failed" });
    expect(mocks.appLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        analysisId: "abc",
        error: expect.any(Error),
        msg: "Writer readme failed",
        writer: "readme",
      }),
    );
  });

  it("stringifies non-Error rejections into the error field", async () => {
    mocks.schedule.mockRejectedValue("boom");

    const result = await runWriterWithLimiter("readme", makeInput(), async () => ({
      content: "doc",
      name: "readme",
      status: "llm",
    }));

    expect(result).toEqual({ error: "boom", name: "readme", status: "failed" });
  });

  it("accepts every writer name for rate-limiter id composition", async () => {
    const names: WriterName[] = ["api", "architecture", "changelog", "contributing", "readme"];
    const writerResult: WriterResult = { content: "x", name: "readme", status: "llm" };
    mocks.schedule.mockResolvedValue(writerResult);

    for (const name of names) {
      await runWriterWithLimiter(
        name,
        makeInput({ analysisId: "abc", selectedTokens: 10 }),
        async () => writerResult,
      );
    }

    for (const name of names) {
      expect(mocks.schedule).toHaveBeenCalledWith(
        { id: `abc-${name}`, weight: Math.ceil(10 * 1.3) + 15_000 },
        expect.any(Function),
      );
    }
  });
});
