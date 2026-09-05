import type { RouterOutput } from "@/core/client";

import { brand, pc } from "@/ui/colors";
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

export function renderRepoConfigTable(config: any): string {
  const table = createTable(["Parameter", "Current Setting", "Description"]);

  const isEnabled = config.enabled ?? true;
  table.push([
    "PR Auto-Analysis",
    isEnabled ? brand.success("● Enabled (Active)") : brand.error("○ Disabled"),
    "Automatic triggers on GitHub Pull Requests",
  ]);

  const ciSkip = config.ciSkip ?? false;
  table.push([
    "CI Skip Directive",
    ciSkip ? brand.warning("Yes ([skip ci])") : brand.muted("No"),
    "Skip checks when commit message contains [skip ci]",
  ]);

  table.push([
    "Comment Style",
    pc.cyan(config.commentStyle ?? "DETAILED"),
    "Summary style for PR review comments",
  ]);

  table.push([
    "Token Budget",
    brand.highlight(String(config.tokenBudget ?? 50_000)),
    "Max AI token consumption per pull request",
  ]);

  const focus =
    Array.isArray(config.focusAreas) && config.focusAreas.length > 0
      ? config.focusAreas.join(", ")
      : "Security, Quality, Dependencies";

  table.push(["Focus Areas", pc.magenta(focus), "Prioritized inspection vector"]);

  return table.toString();
}
