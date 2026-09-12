import * as p from "@clack/prompts";
import type { Command } from "commander";

import { resolveRepository } from "@/core/repo";

import { brand, pc } from "@/ui/colors";
import { parseDateArg } from "@/ui/formatters";
import { renderSection } from "@/ui/layout";
import { output } from "@/ui/output";
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

function buildAnalyticsInput(
  options: AnalyticsCliOptions,
  repoId?: string,
): DashboardStatsInput | null {
  const input: DashboardStatsInput = {};
  if (repoId) {
    input.repoId = repoId;
  }

  if (options.from) {
    const fromDate = parseDateArg(options.from);
    if (!fromDate) {
      p.outro(brand.error(`Invalid --from date format: '${options.from}'. Expected YYYY-MM-DD.`));
      return null;
    }
    input.from = fromDate;
  }

  if (options.to) {
    const toDate = parseDateArg(options.to);
    if (!toDate) {
      p.outro(brand.error(`Invalid --to date format: '${options.to}'. Expected YYYY-MM-DD.`));
      return null;
    }
    input.to = toDate;
  }

  if (input.from && input.to && input.from.getTime() > input.to.getTime()) {
    p.outro(
      brand.error(
        `Invalid date range: --from (${options.from}) cannot be later than --to (${options.to}).`,
      ),
    );
    return null;
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
      if (!inputPayload) {
        return;
      }

      const stats = await withTaskSpinner(
        {
          silent: options.json,
          start: `Aggregating intelligence for ${pc.cyan(targetLabel)}...`,
          stop: "Metrics calculated",
        },
        () => analyticsService.getDashboardStats(inputPayload),
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

      const inputPayload = buildAnalyticsInput(options, repoId);
      if (!inputPayload) {
        return;
      }

      const trendsData = await withTaskSpinner(
        {
          silent: options.json,
          start: `Fetching metric trends for ${pc.cyan(targetLabel)}...`,
          stop: "Trends data loaded",
        },
        () => analyticsService.getTrends(inputPayload),
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
