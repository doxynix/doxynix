import { describe, expect, it } from "vitest";

import { stripAnsi } from "@/ui/formatters";

import { renderDashboardStats, renderTrendsTable } from "./analytics.formatter";

describe("analytics formatter", () => {
  it("renders dashboard metrics and evaluation labels", () => {
    const output = renderDashboardStats({
      analysisStats: { total: 8 },
      overview: {
        avgScores: {
          complexity: 44,
          security: 81,
          techDebt: 56,
        },
        repoCount: 3,
      },
    } as any);

    expect(output).toContain("Security Score");
    expect(output).toContain("Connected Repositories");
    expect(output).toContain("8");
  });

  it("renders trend rows for each period", () => {
    const output = renderTrendsTable([
      {
        complexity: 20,
        date: "2024-01-01",
        security: 80,
        techDebt: 40,
      },
    ] as any);

    expect(output).toContain("2024-01-01");
    expect(output).toContain("80/100");
    expect(output).toContain("40/100");
  });
});

describe("renderTrendsTable", () => {
  it("renders every score the API returns", () => {
    const text = stripAnsi(
      renderTrendsTable([
        {
          complexity: 42,
          date: "Oct 12",
          fullDate: "2026-10-12",
          health: 87,
          onboarding: 78,
          security: 91,
          techDebt: 28,
        },
      ]),
    );

    expect(text).toContain("Health");
    expect(text).toContain("Onboarding");
    expect(text).toContain("87/100");
    expect(text).toContain("78/100");
  });
});
