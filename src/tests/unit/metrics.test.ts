import type { Repo } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  calculateCodeMetrics,
  calculateHealthScore,
  calculateTeamRoles,
} from "@/server/utils/metrics";

describe("calculateHealthScore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-27T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should clamp score to 100 for healthy repository metrics", () => {
    const repo = {
      pushedAt: new Date("2026-02-20T00:00:00.000Z"),
    } as Repo;

    const score = calculateHealthScore(repo, 3, 20);

    expect(score).toBe(100);
  });

  it("should clamp score to 0 for stale repository with weak metrics", () => {
    const repo = {
      pushedAt: new Date("2024-01-01T00:00:00.000Z"),
    } as Repo;

    const score = calculateHealthScore(repo, 1, 2);

    expect(score).toBe(0);
  });
});

describe("calculateCodeMetrics", () => {
  it("should return zeroed metrics for empty input", () => {
    const metrics = calculateCodeMetrics([]);

    expect(metrics).toEqual({
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
  });

  it("should calculate aggregate metrics and language distribution", () => {
    const files = [
      {
        content: "const a = 1;\nconst b = 2;",
        path: "src/index.ts",
      },
      {
        content: "# Title\nText line",
        path: "README.md",
      },
    ];

    const metrics = calculateCodeMetrics(files);

    expect(metrics.fileCount).toBe(2);
    expect(metrics.totalLoc).toBeGreaterThan(0);
    expect(metrics.totalSizeKb).toBe(
      Math.round((files[0].content.length + files[1].content.length) / 1024)
    );
    expect(metrics.languages.length).toBeGreaterThan(0);
  });
});

describe("calculateTeamRoles", () => {
  it("should map contributors to roles based on contribution share and limit to top 5", () => {
    const contributors = [
      { contributions: 60, login: "guardian" },
      { contributions: 25, login: "architect" },
      { contributions: 10, login: "maintainer" },
      { contributions: 3, login: "contributor-1" },
      { contributions: 1, login: "contributor-2" },
      { contributions: 1, login: "contributor-3" },
    ];

    const result = calculateTeamRoles(contributors);

    expect(result).toHaveLength(5);
    expect(result[0]).toEqual({
      login: "guardian",
      role: "Project Guardian",
      share: 60,
    });
    expect(result[1]).toEqual({
      login: "architect",
      role: "Key Architect",
      share: 25,
    });
    expect(result[2]).toEqual({
      login: "maintainer",
      role: "Active Maintainer",
      share: 10,
    });
  });
});
