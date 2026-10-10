import * as p from "@clack/prompts";
import type { Command } from "commander";

import { resolveRepository } from "@/core/repo";

import { brand, pc } from "@/ui/colors";
import { renderSection } from "@/ui/layout";
import { output } from "@/ui/output";
import { withTaskSpinner } from "@/ui/spinner";

import { renderDashboardStats, renderTrendsTable } from "./analytics.formatter";
import { type AnalyticsCliOptions, buildAnalyticsInput } from "./analytics.input";
import { analyticsService } from "./analytics.service";

export type { AnalyticsCliOptions };

export function registerAnalyticsCommand(program: Command) {
  const analytics = program
    .command("analytics")
    .alias("stats")
    .description("Platform engineering insights, health scores, and code trends");

  analytics
    .command("overview", { isDefault: true })
    .description("Display aggregated codebase health and platform metrics")
    .option("-r, --repo <target>", "Filter analytics by repository (owner/name)")
    .option("--from <date>", "Start date filter (YYYY-MM-DD)")
    .option("--to <date>", "End date filter (YYYY-MM-DD)")
    .option("--json", "Output raw JSON payload")
    .action(async (options: AnalyticsCliOptions) => {
      let repoId: string | undefined;
      let targetLabel = "Global Platform";

      if (options.repo) {
        const repoContext = await resolveRepository(
          options.repo,
          "Select repository for analytics overview:",
        );
        if (!repoContext) {
          return;
        }
        repoId = repoContext.repo.id;
        targetLabel = repoContext.target;
      }

      const built = buildAnalyticsInput(options, repoId);
      if (!built.ok) {
        p.outro(brand.error(built.message));
        return;
      }

      const stats = await withTaskSpinner(
        {
          silent: options.json,
          start: `Aggregating intelligence for ${pc.cyan(targetLabel)}...`,
          stop: "Metrics calculated",
        },
        () => analyticsService.getDashboardStats(built.input),
      );

      if (output.json(stats, options.json)) {
        return;
      }

      console.log(
        renderSection(
          brand.logo(`Doxynix Engineering Insights [${targetLabel}]:`),
          renderDashboardStats(stats),
        ),
      );
      p.outro(brand.muted("Run 'dxnx analytics trends' to inspect health scores over time."));
    });

  analytics
    .command("trends")
    .description("View historical trends for security, tech debt, and complexity")
    .option("-r, --repo <target>", "Filter trends by repository (owner/name)")
    .option("--from <date>", "Start date filter (YYYY-MM-DD)")
    .option("--to <date>", "End date filter (YYYY-MM-DD)")
    .option("--json", "Output raw JSON payload")
    .action(async (options: AnalyticsCliOptions) => {
      let repoId: string | undefined;
      let targetLabel = "Global Platform";

      if (options.repo) {
        const repoContext = await resolveRepository(
          options.repo,
          "Select repository for metric trends:",
        );
        if (!repoContext) {
          return;
        }
        repoId = repoContext.repo.id;
        targetLabel = repoContext.target;
      }

      const built = buildAnalyticsInput(options, repoId);
      if (!built.ok) {
        p.outro(brand.error(built.message));
        return;
      }

      const trendsData = await withTaskSpinner(
        {
          silent: options.json,
          start: `Fetching metric trends for ${pc.cyan(targetLabel)}...`,
          stop: "Trends data loaded",
        },
        () => analyticsService.getTrends(built.input),
      );

      if (output.json(trendsData, options.json)) {
        return;
      }

      if (trendsData.length === 0) {
        p.outro(
          brand.muted(`No historical trend data available for ${targetLabel}. Run more analyses!`),
        );
        return;
      }

      console.log(
        renderSection(
          brand.logo(`Historical Code Health Trends [${targetLabel}]:`),
          renderTrendsTable(trendsData),
        ),
      );
      p.outro(brand.success("Done!"));
    });
}
