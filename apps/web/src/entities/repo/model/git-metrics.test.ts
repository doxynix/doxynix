import { describe, expect, it } from "vitest";

import { getGitMetrics } from "./git-metrics";

type RepoInput = {
  defaultBranch: string;
  forks: number;
  id: string;
  language: null | string;
  languageColor: string;
  license: null | string;
  openIssues: number;
  pushedAt: Date | null;
  size: number;
  stars: number;
};

function repo(overrides: Partial<RepoInput> = {}): RepoInput {
  return {
    defaultBranch: "main",
    forks: 2,
    id: "repo-1",
    language: "TypeScript",
    languageColor: "#3178c6",
    license: "MIT",
    openIssues: 3,
    pushedAt: new Date("2026-01-01T00:00:00Z"),
    size: 1500,
    stars: 42,
    ...overrides,
  };
}

describe("getGitMetrics", () => {
  it("wires every metric with its label, tooltip and icon", () => {
    const items = getGitMetrics(repo(), "en");

    expect(items.map((m) => m.id)).toEqual([
      "Language",
      "Stars",
      "Forks",
      "Branch",
      "Open Issues",
      "License",
      "Size",
      "Last push",
    ]);
    expect(items[0]).toMatchObject({
      color: "#3178c6",
      label: "TypeScript",
      tooltip: "Primary Language",
    });
    expect(items[1]?.label).toBe(42);
    expect(items[3]?.label).toBe("main");
    expect(items[4]?.label).toBe(3);
    expect(items[5]?.label).toBe("MIT");
  });

  it("drops raw null labels but keeps last push as an em dash", () => {
    const items = getGitMetrics(repo({ language: null, license: null, pushedAt: null }), "en");

    expect(items.map((m) => m.id)).toEqual([
      "Stars",
      "Forks",
      "Branch",
      "Open Issues",
      "Size",
      "Last push",
    ]);
    expect(items.find((m) => m.id === "Last push")?.label).toBe("—");
  });

  it("keeps a zero star count as a label", () => {
    const items = getGitMetrics(repo({ stars: 0 }), "en");

    expect(items.find((m) => m.id === "Stars")?.label).toBe(0);
  });

  it("formats size in KB below and at 1024", () => {
    expect(getGitMetrics(repo({ size: 0 }), "en").find((m) => m.id === "Size")?.label).toBe("0 KB");
    expect(getGitMetrics(repo({ size: 512 }), "en").find((m) => m.id === "Size")?.label).toBe(
      "512 KB",
    );
    expect(getGitMetrics(repo({ size: 1024 }), "en").find((m) => m.id === "Size")?.label).toBe(
      "1024 KB",
    );
  });

  it("formats size in MB above 1024 with one decimal", () => {
    expect(getGitMetrics(repo({ size: 1025 }), "en").find((m) => m.id === "Size")?.label).toBe(
      "1.0 MB",
    );
    expect(getGitMetrics(repo({ size: 2048 }), "en").find((m) => m.id === "Size")?.label).toBe(
      "2.0 MB",
    );
  });
});
