import { brand, pc } from "@/ui/colors";
import { formatScore, getScoreLabel } from "@/ui/formatters";
import { createTable } from "@/ui/table";

import {
  type AnalysisItem,
  type DetailedMetrics,
  type RepoConfig,
  type StructureMap,
  type WorkspaceSearchResult,
} from "./analyze.types";

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

export function renderRepoConfigTable(config: Partial<RepoConfig>): string {
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

export function renderDetailedMetricsTable(metrics: DetailedMetrics): string {
  const table = createTable(["Category / Dimension", "Value", "Notes"]);

  if (!metrics || typeof metrics !== "object") {
    return brand.muted("No detailed metrics available.");
  }

  for (const [key, value] of Object.entries(metrics)) {
    if (typeof value === "number") {
      table.push([
        brand.highlight(key),
        key.toLowerCase().includes("score") ? formatScore(value) : String(value),
        getScoreLabel(value),
      ]);
    } else if (typeof value === "string") {
      table.push([brand.highlight(key), pc.cyan(value), "—"]);
    } else if (Array.isArray(value)) {
      table.push([brand.highlight(key), `${value.length} items`, "Array collection"]);
    } else if (typeof value === "object" && value !== null) {
      table.push([brand.highlight(key), `${Object.keys(value).length} sub-metrics`, "Group"]);
    }
  }

  return table.toString();
}

export function renderStructureMap(structure: StructureMap): string {
  if (!structure || typeof structure !== "object") {
    return brand.muted("No structure map generated.");
  }

  const table = createTable(["Component / Node", "Type / Entry", "Details"]);

  if (Array.isArray(structure)) {
    for (const node of structure) {
      table.push([
        brand.highlight(String(node.name ?? node.id ?? "Node")),
        pc.cyan(String(node.type ?? "Module")),
        brand.muted(String(node.path ?? "—")),
      ]);
    }
  } else {
    for (const [k, v] of Object.entries(structure)) {
      const summary = Array.isArray(v)
        ? `${v.length} nodes`
        : typeof v === "object"
          ? "Object"
          : String(v);
      table.push([brand.highlight(k), pc.cyan(typeof v), brand.muted(summary)]);
    }
  }

  return table.toString();
}

export function renderSearchResultsTable(results: WorkspaceSearchResult): string {
  if (!results || (Array.isArray(results) && results.length === 0)) {
    return brand.muted("No matching workspace symbols or files found.");
  }

  const table = createTable(["Target Node / Path", "Type / Kind", "Match Context"]);

  if (Array.isArray(results)) {
    for (const item of results) {
      const pathLabel = item.path ?? "Item";
      const typeLabel = item.kind ?? "Symbol";
      const context = item.description ?? "Matched in workspace";

      table.push([
        brand.highlight(String(pathLabel)),
        pc.cyan(String(typeLabel)),
        brand.muted(String(context)),
      ]);
    }
  }

  return table.toString();
}
