import { describe, expect, it } from "vitest";

import { stripAnsi } from "@/ui/formatters";

import {
  renderFixesTable,
  renderPRAnalysisDetails,
  renderPRCommentsTable,
  renderPRImpactDetails,
  renderPRListTable,
} from "./pr.formatter";

describe("pr formatter", () => {
  it("renders the PR list table with status and risk values", () => {
    const output = stripAnsi(
      renderPRListTable([
        {
          findingCount: 2,
          headSha: "abcdef123456",
          prNumber: 42,
          riskScore: 88,
          status: "COMPLETED",
        },
      ] as any),
    );

    expect(output).toContain("#42");
    expect(output).toContain("88/100");
    expect(output).toContain("2");
    expect(output).toContain("abcdef1");
  });

  it("renders fix records and keeps the branch, status, and relative time visible", () => {
    const output = stripAnsi(
      renderFixesTable([
        {
          branch: "fix/scan",
          createdAt: "2024-01-01T00:00:00.000Z",
          id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
          status: "PR_OPENED",
          title: "Patch auth handler",
        } as any,
      ]),
    );

    expect(output).toContain("Patch auth handler");
    expect(output).toContain("fix/scan");
    expect(output).toContain("PR Opened");
  });

  it("renders the comment table and strips HTML from the payload", () => {
    const output = stripAnsi(
      renderPRCommentsTable([
        {
          bodyHtml: "<p>Leaked secret &amp; bug</p>",
          filePath: "src/auth.ts",
          findingType: "SECURITY_FLAW",
          line: 12,
          riskLevel: 91,
        } as any,
      ]),
    );

    expect(output).toContain("src/auth.ts");
    expect(output).toContain("SECURITY_FLAW");
    expect(output).toContain("91/100");
    expect(output).toContain("Leaked secret & bug");
  });

  it("renders the analysis details summary with status and sha metadata", () => {
    const output = stripAnsi(
      renderPRAnalysisDetails({
        baseSha: "bbbbbbbbbbbb",
        createdAt: "2024-01-01T00:00:00.000Z",
        headSha: "aaaaaaaaaaaa",
        id: "analysis-1",
        prNumber: 7,
        riskScore: 67,
        status: "PENDING",
      } as any),
    );

    expect(output).toContain("#7");
    expect(output).toContain("Processing");
    expect(output).toContain("67/100");
    expect(output).toContain("analysis-1");
  });

  it("renders impact summary metrics for affected nodes and findings", () => {
    const output = stripAnsi(
      renderPRImpactDetails({
        affectedNodes: [{ id: "a" }, { id: "b" }],
        topFindings: [{ id: "x" }],
      } as any),
    );

    expect(output).toContain("2");
    expect(output).toContain("1");
    expect(output).toContain("Affected Modules / Nodes");
  });
});
