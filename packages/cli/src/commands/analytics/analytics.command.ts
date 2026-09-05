import * as p from "@clack/prompts";
import type { Command } from "commander";

import { handleCliError } from "@/core/errors";

import { brand } from "@/ui/colors";

import { renderDashboardStats, renderTrendsTable } from "./analytics.formatter";
import { analyticsService } from "./analytics.service";

export function registerAnalyticsCommand(program: Command) {
  const analytics = program
    .command("analytics")
    .alias("stats")
    .description("Platform engineering insights, health scores, and code trends");

  // dxnx analytics (overview)
  analytics
    .command("overview", { isDefault: true })
    .description("Display aggregated codebase health and platform metrics")
    .option("--json", "Output raw JSON payload")
    .action(async (options: { json?: boolean }) => {
      try {
        const s = p.spinner();
        if (!options.json) {
          s.start("Aggregating platform intelligence...");
        }

        const stats = await analyticsService.getDashboardStats();
        if (!options.json) {
          s.stop("Metrics calculated");
        }

        if (options.json) {
          console.log(JSON.stringify(stats, null, 2));
          return;
        }

        console.log(`\n${brand.logo(" 📈 Doxynix Engineering Insights Overview:\n")}`);
        console.log(renderDashboardStats(stats));
        console.log("\n");
        p.outro(brand.muted("Run 'dxnx analytics trends' to track metrics over time."));
      } catch (error) {
        handleCliError(error);
      }
    });

  // dxnx analytics trends
  analytics
    .command("trends")
    .description("View historical trends for security, tech debt, and complexity")
    .option("--json", "Output raw JSON payload")
    .action(async (options: { json?: boolean }) => {
      try {
        const s = p.spinner();
        if (!options.json) {
          s.start("Fetching metric trends...");
        }

        const trendsData = await analyticsService.getTrends();
        if (!options.json) {
          s.stop("Trends data loaded");
        }

        if (options.json) {
          console.log(JSON.stringify(trendsData, null, 2));
          return;
        }

        const items = Array.isArray(trendsData) ? trendsData : ((trendsData as any)?.trends ?? []);

        if (items.length === 0) {
          p.outro(
            brand.muted("No historical trend data available yet. Run more repository analyses!"),
          );
          return;
        }

        console.log(`\n${brand.logo(" 📊 Historical Code Health Trends:\n")}`);
        console.log(renderTrendsTable(items));
        console.log("\n");
        p.outro(brand.success("Done!"));
      } catch (error) {
        handleCliError(error);
      }
    });
}
