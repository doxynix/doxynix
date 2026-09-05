import { brand } from "@/ui/colors";
import { formatScore, getScoreLabel } from "@/ui/formatters";
import { createTable } from "@/ui/table";

export function renderDashboardStats(stats: any): string {
  const table = createTable(["Metric", "Current Value", "Evaluation"]);

  if (stats.securityScore !== undefined) {
    table.push([
      "🛡️ Security Score",
      formatScore(stats.securityScore),
      getScoreLabel(stats.securityScore),
    ]);
  }

  if (stats.techDebtScore !== undefined) {
    table.push([
      "💳 Technical Debt Score",
      formatScore(stats.techDebtScore),
      getScoreLabel(stats.techDebtScore),
    ]);
  }

  if (stats.complexityScore !== undefined) {
    table.push([
      "⚡ Code Complexity Score",
      formatScore(stats.complexityScore),
      getScoreLabel(stats.complexityScore),
    ]);
  }

  if (stats.totalRepositories !== undefined) {
    table.push([
      "📦 Connected Repositories",
      brand.highlight(String(stats.totalRepositories)),
      brand.info("Active"),
    ]);
  }

  if (stats.totalAnalysesRun !== undefined) {
    table.push([
      "🚀 Executed Analyses",
      brand.highlight(String(stats.totalAnalysesRun)),
      brand.success("Processed"),
    ]);
  }

  return table.toString();
}

export function renderTrendsTable(trends: any[]): string {
  const table = createTable(["Period / Date", "Security", "Tech Debt", "Complexity"]);

  for (const item of trends) {
    table.push([
      brand.muted(item.date ? new Date(item.date).toLocaleDateString() : (item.label ?? "N/A")),
      formatScore(item.securityScore),
      formatScore(item.techDebtScore),
      formatScore(item.complexityScore),
    ]);
  }

  return table.toString();
}
