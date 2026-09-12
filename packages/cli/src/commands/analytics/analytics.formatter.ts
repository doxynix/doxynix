import { brand } from "@/ui/colors";
import { formatScore, getScoreLabel } from "@/ui/formatters";
import { icons } from "@/ui/icons";
import { createTable } from "@/ui/table";

import type { DashboardStats, TrendItem } from "./analytics.types";

export function renderDashboardStats(stats: DashboardStats): string {
  const table = createTable(["Metric", "Current Value", "Evaluation"]);
  const { avgScores, repoCount } = stats.overview;

  table.push(
    [
      `${icons.security} Security Score`,
      formatScore(avgScores.security),
      getScoreLabel(avgScores.security),
    ],
    [
      `${icons.warning} Technical Debt Score`,
      formatScore(avgScores.techDebt),
      getScoreLabel(avgScores.techDebt),
    ],
    [
      `${icons.dotWarning} Code Complexity Score`,
      formatScore(avgScores.complexity),
      getScoreLabel(avgScores.complexity),
    ],
    [
      `${icons.package} Connected Repositories`,
      brand.highlight(String(repoCount)),
      brand.info("Active"),
    ],
    [
      `${icons.ai} Executed Analyses`,
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
