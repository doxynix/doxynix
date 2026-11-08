import { describe, expect, it } from "vitest";

import type { PRNumber } from "@/entities/pr/model/pr.types";

import { buildImpactStats, buildPrDetailItems, toFixFinding } from "./pr-details";

const labels = {
  affectedZones: "zones",
  baseSha: "sha",
  changedFiles: "files",
  created: "created",
  status: "status",
};

const statLabels = {
  findings: "findings",
  fixes: "fixes",
  generatedFixes: "generated",
  nodes: "nodes",
  primaryView: "view",
  primaryViewFallback: "none",
  totalIssues: "issues",
};

const impact = {
  navigationHints: { recommendedView: "map" },
  summary: { affectedFiles: 12, affectedNodes: 8, affectedZones: 3, findings: 4, linkedFixes: 2 },
} as unknown as PRNumber;

const analysis = {
  analysis: {
    baseSha: "abcdef1234567",
    createdAt: new Date("2026-01-02T03:04:05Z"),
    status: "COMPLETED",
  },
} as unknown as PRNumber;

describe("buildPrDetailItems", () => {
  it("keeps the discriminant for every row", () => {
    expect(buildPrDetailItems({ analysis, impact, labels }).map((item) => item.kind)).toEqual([
      "copy",
      "status",
      "number",
      "number",
      "time",
    ]);
  });

  it("carries the full sha so the copy button does not need the analysis object", () => {
    expect(buildPrDetailItems({ analysis, impact, labels })[0]).toEqual({
      kind: "copy",
      label: "sha",
      value: "abcdef1234567",
    });
  });

  it("falls back to zeroes and null without data", () => {
    const items = buildPrDetailItems({ analysis: undefined, impact: undefined, labels });

    expect(items[2]).toEqual({ kind: "number", label: "files", value: 0 });
    expect(items[4]).toEqual({ kind: "time", label: "created", value: null });
  });
});

describe("buildImpactStats", () => {
  it("keeps the declared order", () => {
    const stats = buildImpactStats({
      commentsCount: 5,
      fixesCount: 2,
      impact,
      labels: statLabels,
    });

    expect(stats.map((stat) => stat.label)).toEqual([
      "nodes",
      "findings",
      "fixes",
      "view",
      "issues",
      "generated",
    ]);
  });

  it("uses the fallback view when navigation hints have none", () => {
    const stats = buildImpactStats({
      commentsCount: 0,
      fixesCount: 0,
      impact: undefined,
      labels: statLabels,
    });

    expect(stats[3]).toEqual({ label: "view", value: "none" });
  });
});

describe("toFixFinding", () => {
  it("normalises the finding type and maps the fields", () => {
    expect(
      toFixFinding({
        bodyHtml: "<p>x</p>",
        filePath: "src/a.ts",
        findingType: "SECURITY",
        line: 42,
      }),
    ).toEqual({ file: "src/a.ts", line: 42, suggestion: "<p>x</p>", type: "security" });
  });
});
