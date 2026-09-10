import { brand } from "@/ui/colors";
import { formatScore, getScoreLabel } from "@/ui/formatters";
import { createTable } from "@/ui/table";

import type { DashboardStats, TrendItem } from "./analytics.types";

export function renderDashboardStats(stats: DashboardStats): string {
  const table = createTable(["Metric", "Current Value", "Evaluation"]);
  const { avgScores, repoCount } = stats.overview;

  table.push(
    ["🛡️ Security Score", formatScore(avgScores.security), getScoreLabel(avgScores.security)],
    ["💳 Technical Debt Score", formatScore(avgScores.techDebt), getScoreLabel(avgScores.techDebt)],
    [
      "⚡ Code Complexity Score",
      formatScore(avgScores.complexity),
      getScoreLabel(avgScores.complexity),
    ],
    ["📦 Connected Repositories", brand.highlight(String(repoCount)), brand.info("Active")],
    [
      "🚀 Executed Analyses",
      brand.highlight(String(stats.analysisStats.total)),
      brand.success("Processed"),
    ],
  );

  return table.toString();
}

export function renderTrendsTable(trends: TrendItem[]): string {
  const table = createTable(["Period / Date", "Security", "Tech Debt", "Complexity"]);

  for (const item of trends) {
    table.push([
      brand.muted(item.date || item.fullDate),
      formatScore(item.security),
      formatScore(item.techDebt),
      formatScore(item.complexity),
    ]);
  }

  return table.toString();
}
