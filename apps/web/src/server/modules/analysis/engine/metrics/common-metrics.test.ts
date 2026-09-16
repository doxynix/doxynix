import simpleGit from "simple-git";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { calculateCodeMetrics as calculateFullCodeMetrics } from "./code-metrics";
import {
  calculateCodeMetrics,
  calculateTeamRoles,
  computeChangeCoupling,
  computeGitChurnHotspots,
} from "./common-metrics";

vi.mock("simple-git", () => ({
  default: vi.fn(),
}));

vi.mock("./code-metrics", () => ({
  calculateCodeMetrics: vi.fn(),
}));

vi.mock("@/server/core/realtime", () => ({
  realtimeService: { user: vi.fn(() => ({ publish: vi.fn() })) },
}));

vi.mock("@/server/core/db", () => ({ prisma: {} }));

describe("calculateCodeMetrics", () => {
  const fullSpy = vi.mocked(calculateFullCodeMetrics);

  beforeEach(() => {
    fullSpy.mockReset();
  });

  it("returns zeros for empty file sets", async () => {
    const result = await calculateCodeMetrics([]);

    expect(result).toEqual({
      complexityScore: 0,
      docDensity: 0,
      fileCount: 0,
      languages: [],
      modularityIndex: 0,
      mostComplexFiles: [],
      techDebtScore: 0,
      totalLoc: 0,
      totalSizeKb: 0,
    });
    expect(fullSpy).not.toHaveBeenCalled();
  });

  it("maps the full repository metrics to the simplified public shape", async () => {
    fullSpy.mockResolvedValue({
      complexityScore: 82,
      docDensity: 0.4,
      fileCount: 3,
      languages: [{ color: "#60a5fa", lines: 120, name: "TypeScript" }],
      modularityIndex: 0.71,
      mostComplexFiles: ["src/server/index.ts"],
      techDebtScore: 63,
      totalLoc: 180,
      totalSizeKb: 24,
    } as any);

    const result = await calculateCodeMetrics([
      { content: "const answer = 42;", path: "src/server/index.ts" },
    ]);

    expect(result).toEqual({
      complexityScore: 82,
      docDensity: 0.4,
      fileCount: 3,
      languages: [{ color: "#60a5fa", lines: 120, name: "TypeScript" }],
      modularityIndex: 0.71,
      mostComplexFiles: ["src/server/index.ts"],
      techDebtScore: 63,
      totalLoc: 180,
      totalSizeKb: 24,
    });
    expect(fullSpy).toHaveBeenCalledWith([
      { content: "const answer = 42;", path: "src/server/index.ts" },
    ]);
  });
});

describe("calculateTeamRoles", () => {
  it("classifies contributors by share of total contributions", () => {
    const roles = calculateTeamRoles([
      { contributions: 60, login: "alice" },
      { contributions: 25, login: "bob" },
      { contributions: 10, login: "charlie" },
      { contributions: 5, login: "dana" },
    ]);

    expect(roles).toEqual([
      { login: "alice", role: "Project Guardian", share: 60 },
      { login: "bob", role: "Key Architect", share: 25 },
      { login: "charlie", role: "Active Maintainer", share: 10 },
      { login: "dana", role: "Contributor", share: 5 },
    ]);
  });

  it("returns empty roles when no contributions exist", () => {
    expect(calculateTeamRoles([])).toEqual([]);
  });
});

describe("computeGitChurnHotspots", () => {
  const gitMock = vi.mocked(simpleGit);

  beforeEach(() => {
    gitMock.mockReset();
  });

  it("counts recent churn for selected files and normalizes paths", async () => {
    gitMock.mockReturnValue({
      raw: vi.fn().mockResolvedValue("src/server/a.ts\nsrc/server/a.ts\nsrc/shared/util.ts\n"),
    } as any);

    const result = await computeGitChurnHotspots("/tmp/repo", [
      "src/server/a.ts",
      "src/shared/util.ts",
      "src/ignored.ts",
    ]);

    expect(result).toEqual([
      { churnScore: 100, commitsInWindow: 2, path: "src/server/a.ts" },
      { churnScore: 50, commitsInWindow: 1, path: "src/shared/util.ts" },
    ]);
  });

  it("returns an empty list when git history is unavailable", async () => {
    gitMock.mockReturnValue({
      raw: vi.fn().mockRejectedValue(new Error("git failed")),
    } as any);

    await expect(computeGitChurnHotspots("/tmp/repo", ["src/server/a.ts"])).resolves.toEqual([]);
  });
});

describe("computeChangeCoupling", () => {
  const gitMock = vi.mocked(simpleGit);

  beforeEach(() => {
    gitMock.mockReset();
  });

  it("finds pairs that change together across relevant architecture files", async () => {
    gitMock.mockReturnValue({
      raw: vi
        .fn()
        .mockResolvedValue(
          "--commit--\nsrc/server/a.ts\nsrc/server/b.ts\n--commit--\nsrc/server/a.ts\nsrc/server/c.ts\n--commit--\nsrc/server/a.ts\nsrc/server/b.ts\nsrc/server/c.ts\n",
        ),
    } as any);

    const result = await computeChangeCoupling("/tmp/repo", [
      "src/server/a.ts",
      "src/server/b.ts",
      "src/server/c.ts",
    ]);

    expect(result).toEqual([
      { commits: 2, fromPath: "src/server/a.ts", toPath: "src/server/b.ts" },
      { commits: 2, fromPath: "src/server/a.ts", toPath: "src/server/c.ts" },
    ]);
  });

  it("returns an empty list when the allowed file set is empty", async () => {
    await expect(computeChangeCoupling("/tmp/repo", [])).resolves.toEqual([]);
  });
});
