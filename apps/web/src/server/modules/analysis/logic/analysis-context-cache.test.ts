import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RepoSnapshot } from "../analysis.repository";
import { getCachedAnalyzeContext } from "./analysis-context-cache";
import { createAnalyzeContextBuilder } from "./analyze-context-builder";

vi.mock("./analyze-context-builder", () => ({
  createAnalyzeContextBuilder: vi.fn(() => ({})),
}));

const build = vi.mocked(createAnalyzeContextBuilder);

function makeRepo(repoId: string, analysisId: string) {
  return { analyses: [{ id: analysisId }], id: repoId } as unknown as RepoSnapshot;
}

describe("getCachedAnalyzeContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the same builder for the same repo and analysis", () => {
    const repo = makeRepo("repo-shared", "analysis-shared");

    const first = getCachedAnalyzeContext(repo);

    expect(getCachedAnalyzeContext(repo)).toBe(first);
    expect(build).toHaveBeenCalledTimes(1);
  });

  it("builds a new builder for another analysis of the same repo", () => {
    const first = getCachedAnalyzeContext(makeRepo("repo-versions", "analysis-a"));
    const second = getCachedAnalyzeContext(makeRepo("repo-versions", "analysis-b"));

    expect(second).not.toBe(first);
    expect(build).toHaveBeenCalledTimes(2);
  });

  it("evicts the oldest entry once 32 contexts are held", () => {
    const firstRepo = makeRepo("repo-cap-0", "analysis-cap-0");
    const firstBuilder = getCachedAnalyzeContext(firstRepo);

    let lastRepo = firstRepo;
    let lastBuilder = firstBuilder;

    for (let index = 1; index < 40; index += 1) {
      lastRepo = makeRepo(`repo-cap-${index}`, `analysis-cap-${index}`);
      lastBuilder = getCachedAnalyzeContext(lastRepo);
    }

    expect(build).toHaveBeenCalledTimes(40);
    expect(getCachedAnalyzeContext(lastRepo)).toBe(lastBuilder);
    expect(getCachedAnalyzeContext(firstRepo)).not.toBe(firstBuilder);
  });
});
