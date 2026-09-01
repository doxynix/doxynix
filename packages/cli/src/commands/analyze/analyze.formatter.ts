import type { RouterOutput } from "@/core/client";

import { brand } from "@/ui/colors";
import { formatScore, getScoreLabel } from "@/ui/formatters";
import { createTable } from "@/ui/table";

export type AnalysisItem = NonNullable<RouterOutput["analysis"]["getLatest"]>;

export function formatStatus(status: string): string {
  switch (status) {
    case "DONE":
    case "COMPLETED": {
      return brand.success("✔ Completed (DONE)");
    }
    case "FAILED": {
      return brand.error("✖ Failed (FAILED)");
    }
    case "ANALYZING":
    case "PENDING": {
      return brand.info("⏳ Processing (ANALYZING)");
    }
    default: {
      return brand.muted(status);
    }
  }
}

export function renderAnalysisTable(analysis: AnalysisItem): string {
  const table = createTable(["Metric", "Score", "Health"]);
  table.push(
    ["🛡️ Security", formatScore(analysis.securityScore), getScoreLabel(analysis.securityScore)],
    [
      "⚡ Code Complexity",
      formatScore(analysis.complexityScore),
      getScoreLabel(analysis.complexityScore),
    ],
    [
      "💳 Technical Debt",
      formatScore(analysis.techDebtScore),
      getScoreLabel(analysis.techDebtScore),
    ],
    [
      "🚀 Developer Onboarding",
      formatScore(analysis.onboardingScore),
      getScoreLabel(analysis.onboardingScore),
    ],
  );
  return table.toString();
}
