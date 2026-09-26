import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * DXNX-239. Only system boundaries are mocked: the AI provider
 * (`callWithFallback`) and the remote model config (Edge Config). Everything
 * else - CodeOptimizer, the prompt builder, the tool profile and the shared
 * analysis.utils heuristics - runs for real, so these tests exercise the real
 * decision logic rather than a re-statement of it.
 */
const callWithFallback = vi.hoisted(() => vi.fn());
const edgeConfigGet = vi.hoisted(() => vi.fn());

vi.mock("@/server/utils/call", () => ({ callWithFallback }));
vi.mock("@vercel/edge-config", () => ({ get: edgeConfigGet }));

const { runQuickFileAudit } = await import("./quick-file-audit");

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

const FILE_ACTION = {
  branch: "main",
  content: "export const add = (a: number, b: number) => a + b;\n",
  language: "English",
  path: "src/math/add.ts",
  repoId: "repo-1",
};

beforeEach(() => {
  callWithFallback.mockReset();
  edgeConfigGet.mockReset();
  // null makes getActiveModels fall back to its static defaults, deterministically.
  edgeConfigGet.mockResolvedValue(null);
  callWithFallback.mockResolvedValue({
    confidence: "high",
    issues: [{ line: 1, message: "no tests", severity: "LOW" }],
    strengths: ["pure function"],
    suggestions: ["add tests"],
    summary: "Looks fine overall.",
  });
});

describe("runQuickFileAudit", () => {
  it("audits a normal source file", async () => {
    const result = await runQuickFileAudit(7, FILE_ACTION);

    expect(callWithFallback).toHaveBeenCalledTimes(1);
    expect(result.path).toBe("src/math/add.ts");
    expect(result.confidence).toBe("high");
    expect(result.summary).toBe("Looks fine overall.");
  });

  it("embeds the target path and the code in the user prompt", async () => {
    await runQuickFileAudit(7, FILE_ACTION);

    const { prompt } = firstCall();
    expect(prompt).toContain('<target_file path="src/math/add.ts">');
    expect(prompt).toContain("export const add");
    expect(prompt).toContain("</target_file>");
  });

  it("tags the call so the AI provider can attribute the request", async () => {
    await runQuickFileAudit(7, FILE_ACTION);

    expect(firstCall()).toMatchObject({
      attemptMetadata: { filePath: "src/math/add.ts", operation: "quick-file-audit" },
      taskType: "classification",
    });
  });

  it("returns a low-confidence fallback for empty content without calling the model", async () => {
    const result = await runQuickFileAudit(7, { ...FILE_ACTION, content: "   \n  " });

    expect(callWithFallback).not.toHaveBeenCalled();
    expect(result.confidence).toBe("low");
    expect(result.issues).toEqual([]);
    expect(result.summary).toContain("empty");
  });

  it("returns a fallback for binary-like content without calling the model", async () => {
    const result = await runQuickFileAudit(7, {
      ...FILE_ACTION,
      content: `const a = 1;\u0000\u0001\u0002binary`,
    });

    expect(callWithFallback).not.toHaveBeenCalled();
    expect(result.summary).toContain("binary");
  });

  it("returns a fallback for a lock file without calling the model", async () => {
    const result = await runQuickFileAudit(7, {
      ...FILE_ACTION,
      content: '{"lockfileVersion":3,"packages":{}}',
      path: "bun.lock",
    });

    expect(callWithFallback).not.toHaveBeenCalled();
    expect(result.summary).toMatch(/lock|build metadata/i);
  });

  it("returns a fallback for an env file without calling the model", async () => {
    const result = await runQuickFileAudit(7, {
      ...FILE_ACTION,
      content: "API_KEY=secret\n",
      path: ".env",
    });

    expect(callWithFallback).not.toHaveBeenCalled();
    expect(result.summary).toMatch(/sensitive/i);
  });

  it("returns a fallback for a generated file without calling the model", async () => {
    const result = await runQuickFileAudit(7, {
      ...FILE_ACTION,
      content: "export const routes = {};\n",
      path: "src/generated/schema.ts",
    });

    expect(callWithFallback).not.toHaveBeenCalled();
    expect(result.summary).toMatch(/generated/i);
  });

  it("explains why it skipped the file", async () => {
    const result = await runQuickFileAudit(7, { ...FILE_ACTION, content: "  ", path: "bun.lock" });

    expect(result.summary).toMatch(/empty/i);
    expect(result.summary.length).toBeGreaterThan(20);
  });
});
