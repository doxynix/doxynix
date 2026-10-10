import { describe, expect, it } from "vitest";

import { stripAnsi } from "@/ui/formatters";

import {
  renderAnalysisTable,
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
    expect(output).toContain("No matching workspace symbols or files found");
  });
});
