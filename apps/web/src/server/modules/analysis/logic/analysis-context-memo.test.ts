import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RepoSnapshot } from "../analysis.repository";
import {
  analyzeContextMemoSize,
  getMemoizedAnalyzeContext,
  resetAnalyzeContextMemo,
} from "./analysis-context-memo";
import { createAnalyzeContextBuilder } from "./analyze-context-builder";

vi.mock("./analyze-context-builder", () => ({
  createAnalyzeContextBuilder: vi.fn(() => ({})),
}));

const build = vi.mocked(createAnalyzeContextBuilder);

function makeRepo(repoId: string, analysisId: string) {
  return { analyses: [{ id: analysisId }], id: repoId } as unknown as RepoSnapshot;
}

describe("getMemoizedAnalyzeContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAnalyzeContextMemo();
  });

  it("returns the same builder for the same repo and analysis", () => {
    const repo = makeRepo("repo-shared", "analysis-shared");

    const first = getMemoizedAnalyzeContext(repo);

    expect(getMemoizedAnalyzeContext(repo)).toBe(first);
    expect(build).toHaveBeenCalledTimes(1);
  });

  it("builds a new builder for another analysis of the same repo", () => {
    const first = getMemoizedAnalyzeContext(makeRepo("repo-versions", "analysis-a"));
    const second = getMemoizedAnalyzeContext(makeRepo("repo-versions", "analysis-b"));

    expect(second).not.toBe(first);
    expect(build).toHaveBeenCalledTimes(2);
  });

  it("never holds more than 32 contexts", () => {
    const firstRepo = makeRepo("repo-cap-0", "analysis-cap-0");
    const firstBuilder = getMemoizedAnalyzeContext(firstRepo);

    let lastRepo = firstRepo;
    let lastBuilder = firstBuilder;

    for (let index = 1; index < 40; index += 1) {
      lastRepo = makeRepo(`repo-cap-${index}`, `analysis-cap-${index}`);
      lastBuilder = getMemoizedAnalyzeContext(lastRepo);
    }

    expect(analyzeContextMemoSize()).toBe(32);
    expect(getMemoizedAnalyzeContext(lastRepo)).toBe(lastBuilder);
    expect(analyzeContextMemoSize()).toBe(32);
    expect(getMemoizedAnalyzeContext(firstRepo)).not.toBe(firstBuilder);
    expect(analyzeContextMemoSize()).toBe(32);
  });
});
