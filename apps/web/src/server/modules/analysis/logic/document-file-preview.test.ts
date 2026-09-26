import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * DXNX-239. Only system boundaries are mocked: the AI provider
 * (`callWithFallback`) and the remote model config (Edge Config). The surgical
 * edit applier and the shared heuristics run for real, so the edit-application
 * loop is genuinely covered.
 */
const callWithFallback = vi.hoisted(() => vi.fn());
const edgeConfigGet = vi.hoisted(() => vi.fn());

vi.mock("@/server/utils/call", () => ({ callWithFallback }));
vi.mock("@vercel/edge-config", () => ({ get: edgeConfigGet }));

const { runDocumentFilePreview } = await import("./document-file-preview");

type CallArgs = {
  attemptMetadata?: Record<string, unknown>;
  prompt: string;
  system: string;
  taskType?: string;
};

/** `noUncheckedIndexedAccess` + oxlint's no-unsafe-optional-chaining guard. */
function firstCall(): CallArgs {
  const [call] = callWithFallback.mock.calls;
  if (call == null) {
    throw new Error("expected callWithFallback to have been called");
  }
  return call[0] as CallArgs;
}

const SOURCE = ["/** Adds two numbers. */", "export const add = (a, b) => a + b;"].join("\n");

const FILE_ACTION = {
  branch: "main",
  content: SOURCE,
  language: "English",
  path: "src/math/add.ts",
  repoId: "repo-1",
};

beforeEach(() => {
  callWithFallback.mockReset();
  edgeConfigGet.mockReset();
  edgeConfigGet.mockResolvedValue(null);
  callWithFallback.mockResolvedValue({
    confidence: "high",
    edits: [],
    summary: "Documented the arithmetic helper.",
  });
});

describe("runDocumentFilePreview", () => {
  it("documents a normal source file", async () => {
    const result = await runDocumentFilePreview(7, FILE_ACTION);

    expect(callWithFallback).toHaveBeenCalledTimes(1);
    expect(result.path).toBe("src/math/add.ts");
    expect(result.confidence).toBe("high");
    expect(result.summary).toBe("Documented the arithmetic helper.");
  });

  it("returns the original code untouched when the model proposes no edits", async () => {
    const result = await runDocumentFilePreview(7, FILE_ACTION);

    expect(result.documentation).toBe(SOURCE);
    expect(result.edits).toEqual([]);
  });

  it("embeds the target path and the code in the user prompt", async () => {
    await runDocumentFilePreview(7, FILE_ACTION);

    const { prompt } = firstCall();
    expect(prompt).toContain('<target_file path="src/math/add.ts">');
    expect(prompt).toContain("export const add");
  });

  it("requests a creative pass with the documentation output schema", async () => {
    await runDocumentFilePreview(7, FILE_ACTION);

    expect(firstCall()).toMatchObject({
      attemptMetadata: { filePath: "src/math/add.ts", operation: "document-file-preview" },
      taskType: "creative",
    });
  });

  it("applies a proposed search-and-replace edit to the code", async () => {
    callWithFallback.mockResolvedValue({
      confidence: "high",
      edits: [{ replace: "/** Sums two numbers. */", search: "/** Adds two numbers. */" }],
      summary: "Reworded the doc comment.",
    });

    const result = await runDocumentFilePreview(7, FILE_ACTION);

    expect(result.documentation).toBe(SOURCE.replace("Adds", "Sums"));
    expect(result.documentation).toContain("/** Sums two numbers. */");
  });

  it("applies several edits in order", async () => {
    callWithFallback.mockResolvedValue({
      confidence: "high",
      edits: [
        { replace: "/** Sums two numbers. */", search: "/** Adds two numbers. */" },
        {
          replace: "export const add = (a, b) => a + b; // pure",
          search: "export const add = (a, b) => a + b;",
        },
      ],
      summary: "Two edits.",
    });

    const result = await runDocumentFilePreview(7, FILE_ACTION);

    expect(result.documentation).toContain("Sums two numbers");
    expect(result.documentation).toContain("// pure");
  });

  it("keeps the original code when an edit block cannot be located", async () => {
    callWithFallback.mockResolvedValue({
      confidence: "low",
      edits: [{ replace: "new", search: "a block that is definitely not in the file" }],
      summary: "Hallucinated edit.",
    });

    const result = await runDocumentFilePreview(7, FILE_ACTION);

    expect(result.documentation).toBe(SOURCE);
  });

  it("ignores an edit with an empty search or replace", async () => {
    callWithFallback.mockResolvedValue({
      confidence: "high",
      edits: [{ replace: "", search: "/** Adds two numbers. */" }],
      summary: "Empty replace.",
    });

    const result = await runDocumentFilePreview(7, FILE_ACTION);

    expect(result.documentation).toBe(SOURCE);
  });

  it("returns a fallback for empty content without calling the model", async () => {
    const result = await runDocumentFilePreview(7, { ...FILE_ACTION, content: "\n \t " });

    expect(callWithFallback).not.toHaveBeenCalled();
    expect(result.summary).toMatch(/empty/i);
    // buildDocumentFallback puts the explanation in `documentation` as well as
    // `summary`. Safe today because the task only caches this as a UI preview;
    // it would be wrong if this value ever became the new file content.
    expect(result.documentation).toBe(result.summary);
    expect(result.edits).toEqual([]);
  });

  it("returns a fallback for binary-like content without calling the model", async () => {
    const result = await runDocumentFilePreview(7, {
      ...FILE_ACTION,
      content: "binary\u0000\u0001data",
    });

    expect(callWithFallback).not.toHaveBeenCalled();
    expect(result.summary).toMatch(/binary|non-textual/i);
  });

  it("returns a fallback for a lock file without calling the model", async () => {
    const result = await runDocumentFilePreview(7, {
      ...FILE_ACTION,
      content: '{"lockfileVersion":3}',
      path: "bun.lock",
    });

    expect(callWithFallback).not.toHaveBeenCalled();
    expect(result.summary).toMatch(/lock|build metadata/i);
  });

  it("returns a fallback for an env file without calling the model", async () => {
    const result = await runDocumentFilePreview(7, {
      ...FILE_ACTION,
      content: "TOKEN=abc\n",
      path: ".env",
    });

    expect(callWithFallback).not.toHaveBeenCalled();
    expect(result.summary).toMatch(/sensitive/i);
  });
});
