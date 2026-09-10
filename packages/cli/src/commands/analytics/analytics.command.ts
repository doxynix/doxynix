import * as p from "@clack/prompts";
import type { Command } from "commander";

import { handleCliError } from "@/core/errors";
import { resolveRepository } from "@/core/repo";

import { brand, pc } from "@/ui/colors";
import { withTaskSpinner } from "@/ui/spinner";

import { renderDashboardStats, renderTrendsTable } from "./analytics.formatter";
import { analyticsService } from "./analytics.service";
import type { DashboardStatsInput } from "./analytics.types";

type AnalyticsCliOptions = {
  from?: string;
  json?: boolean;
  repo?: string;
  to?: string;
};

function buildAnalyticsInput(options: AnalyticsCliOptions, repoId?: string): DashboardStatsInput {
  const input: DashboardStatsInput = {};
  if (repoId) {
    input.repoId = repoId;
  }
  if (options.from) {
    input.from = new Date(options.from);
  }
  if (options.to) {
    input.to = new Date(options.to);
  }
  return input;
}

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
      try {
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

        const inputPayload = buildAnalyticsInput(options, repoId);
        const stats = await withTaskSpinner(
          {
            silent: options.json,
            start: `Aggregating intelligence for ${pc.cyan(targetLabel)}...`,
            stop: "Metrics calculated",
          },
          () => analyticsService.getDashboardStats(inputPayload),
        );

        if (options.json) {
          console.log(JSON.stringify(stats, null, 2));
          return;
        }

        console.log(`\n${brand.logo(` 📈 Doxynix Engineering Insights [${targetLabel}]:\n`)}`);
        console.log(renderDashboardStats(stats));
        console.log("\n");
        p.outro(brand.muted("Run 'dxnx analytics trends' to inspect health scores over time."));
      } catch (error) {
        handleCliError(error);
      }
    });

  analytics
    .command("trends")
    .description("View historical trends for security, tech debt, and complexity")
    .option("-r, --repo <target>", "Filter trends by repository (owner/name)")
    .option("--from <date>", "Start date filter (YYYY-MM-DD)")
    .option("--to <date>", "End date filter (YYYY-MM-DD)")
    .option("--json", "Output raw JSON payload")
    .action(async (options: AnalyticsCliOptions) => {
      try {
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

        const inputPayload = buildAnalyticsInput(options, repoId);
        const trendsData = await withTaskSpinner(
          {
            silent: options.json,
            start: `Fetching metric trends for ${pc.cyan(targetLabel)}...`,
            stop: "Trends data loaded",
          },
          () => analyticsService.getTrends(inputPayload),
        );

        if (options.json) {
          console.log(JSON.stringify(trendsData, null, 2));
          return;
        }

        if (trendsData.length === 0) {
          p.outro(
            brand.muted(
              `No historical trend data available for ${targetLabel}. Run more analyses!`,
            ),
          );
          return;
        }

        console.log(`\n${brand.logo(` 📊 Historical Code Health Trends [${targetLabel}]:\n`)}`);
        console.log(renderTrendsTable(trendsData));
        console.log("\n");
        p.outro(brand.success("Done!"));
      } catch (error) {
        handleCliError(error);
      }
    });
}
