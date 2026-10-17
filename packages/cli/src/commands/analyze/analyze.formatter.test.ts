import { describe, expect, it } from "vitest";

import { stripAnsi } from "@/ui/formatters";

import {
  flattenMetricRows,
  renderAnalysisTable,
  renderAuditResult,
  renderDetailedMetricsTable,
  renderRepoConfigTable,
  renderSearchResultsTable,
  renderStructureMap,
} from "./analyze.formatter";

describe("analyze formatter", () => {
  it("renders the analysis summary table with core metrics", () => {
    const output = stripAnsi(
      renderAnalysisTable({
        complexityScore: 74,
        onboardingScore: 81,
        securityScore: 95,
        techDebtScore: 52,
      } as any),
    );

    expect(output).toContain("Security");
    expect(output).toContain("Code Complexity");
    expect(output).toContain("95/100");
    expect(output).toContain("81/100");
  });

  it("renders repo config values using the current defaults and overrides", () => {
    const output = stripAnsi(
      renderRepoConfigTable({
        ciSkip: true,
        commentStyle: "CONCISE",
        enabled: false,
        focusAreas: ["SECURITY", "PERFORMANCE"],
        tokenBudget: 12_000,
      }),
    );

    expect(output).toContain("PR Auto-Analysis");
    expect(output).toContain("Disabled");
    expect(output).toContain("Yes ([skip ci])");
    expect(output).toContain("CONCISE");
    // Joined verbatim; PRFocusArea values arrive UPPER_CASE from the server.
    expect(output).toContain("SECURITY, PERFORMANCE");
  });

  it("falls back to the default focus areas when none are configured", () => {
    const output = stripAnsi(
      renderRepoConfigTable({
        ciSkip: false,
        commentStyle: "OFF",
        enabled: true,
        focusAreas: [],
        tokenBudget: 0,
      }),
    );

    expect(output).toContain("Security, Quality, Dependencies");
  });

  it("renders detailed metrics grouped by object keys", () => {
    const output = stripAnsi(
      renderDetailedMetricsTable({
        bugCount: 2,
        coverage: 88,
        labels: ["a", "b"],
        summary: "healthy",
      } as any),
    );

    expect(output).toContain("bugCount");
    expect(output).toContain("coverage");
    expect(output).toContain("88");
    expect(output).toContain("2 items");
  });

  it("does not claim metrics are missing when every group is empty", () => {
    const output = stripAnsi(renderDetailedMetricsTable({ generatedAt: {} } as any));

    expect(output).toContain("generatedAt");
    expect(output).not.toContain("No detailed metrics available");
  });

  it("renders structure maps from either arrays or object payloads", () => {
    const fromArray = stripAnsi(
      renderStructureMap([{ id: "root", name: "src", path: "/src", type: "root" }] as any),
    );
    const fromObject = stripAnsi(renderStructureMap({ app: { name: "app" } } as any));

    expect(fromArray).toContain("src");
    expect(fromArray).toContain("root");
    expect(fromObject).toContain("app");
  });

  it("renders a muted empty state for no workspace results", () => {
    const output = stripAnsi(renderSearchResultsTable([]));
    expect(output).toContain("No workspace matches");
  });
});

describe("flattenMetricRows", () => {
  it("flattens nested groups into dotted paths", () => {
    const rows = flattenMetricRows({
      quality: { complexity: 42, health: 87, securityScore: 95 },
      risks: { topRisks: [{ title: "a" }] },
    }).map((row) => [row[0], stripAnsi(row[1]), stripAnsi(row[2])]);

    // Only "securityScore" carries a score label; raw counts stay unlabelled.
    expect(rows).toContainEqual(["quality.complexity", "42", "Number"]);
    expect(rows).toContainEqual(["quality.health", "87", "Number"]);
    expect(rows).toContainEqual(["quality.securityScore", "95/100", "Excellent"]);
    expect(rows).toContainEqual(["risks.topRisks", "1 item", "Array"]);
  });

  it("does not descend into arrays or nulls", () => {
    const rows = flattenMetricRows({ a: [1, 2, 3], b: null, c: { d: null } });

    expect(rows).toEqual([
      ["a", "3 items", "Array"],
      ["b", "—", "Empty"],
      ["c.d", "—", "Empty"],
    ]);
  });

  it("emits an empty row for a group with no entries", () => {
    expect(flattenMetricRows({ generatedAt: {}, totalFiles: 12 })).toEqual([
      ["generatedAt", "—", "Empty"],
      ["totalFiles", "12", "Number"],
    ]);
    expect(flattenMetricRows({ a: { b: {} } })).toEqual([["a.b", "—", "Empty"]]);
  });

  it("returns nothing for a null or non-object payload", () => {
    expect(flattenMetricRows(null)).toEqual([]);
    expect(flattenMetricRows("nope")).toEqual([]);
  });
});

describe("renderStructureMap", () => {
  it("renders an empty-state message instead of throwing on a null payload", () => {
    expect(stripAnsi(renderStructureMap(null))).toContain("No structure map");
  });

  it("renders an empty-state message for an empty array", () => {
    expect(stripAnsi(renderStructureMap([] as never))).toContain("No structure map");
  });
});

describe("renderAuditResult", () => {
  it("shows the job id and the command to run next", () => {
    const text = stripAnsi(renderAuditResult({ jobId: "run_123" }, "src/a.ts", "doxynix/doxynix"));

    expect(text).toContain("run_123");
    expect(text).toContain("dxnx analyze status doxynix/doxynix");
  });

  it("frames the result once, with a title and no undefined content", () => {
    const text = stripAnsi(renderAuditResult({ jobId: "run_123" }, "src/a.ts", "doxynix/doxynix"));

    expect(text).toContain("=== Single-File Audit Queued ===");
    expect(text).not.toContain("undefined");
    expect(text.match(/=== End ===/g)).toHaveLength(1);
  });
});
