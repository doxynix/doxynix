import { brand, pc } from "@/ui/colors";
import { formatScore, getScoreLabel, truncateToWidth } from "@/ui/formatters";
import { icons } from "@/ui/icons";
import { renderBlock } from "@/ui/layout";
import { createTable } from "@/ui/table";

import type {
  AnalysisItem,
  DetailedMetrics,
  RepoConfig,
  StructureMap,
  WorkspaceSearchResult,
} from "./analyze.types";

export function renderAnalysisTable(analysis: AnalysisItem): string {
  const table = createTable(["Dimension", "Score", "Health"]);
  table.push(
    [
      `${icons.security} Security`,
      formatScore(analysis.securityScore),
      getScoreLabel(analysis.securityScore),
    ],
    [
      `${icons.dotWarning} Code Complexity`,
      formatScore(analysis.complexityScore),
      getScoreLabel(analysis.complexityScore),
    ],
    [
      `${icons.warning} Technical Debt`,
      formatScore(analysis.techDebtScore),
      getScoreLabel(analysis.techDebtScore),
    ],
    [
      `${icons.ai} Developer Onboarding`,
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
    isEnabled
      ? brand.success(`${icons.dot} Enabled (Active)`)
      : brand.error(`${icons.dotMuted} Disabled`),
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

const MAX_METRIC_DEPTH = 3;

function isScoreKey(key: string): boolean {
  return key.toLowerCase().includes("score");
}

function describeValue(key: string, value: unknown): [string, string] {
  if (value === null || value === undefined) {
    return ["—", "Empty"];
  }

  if (typeof value === "number") {
    return isScoreKey(key) ? [formatScore(value), getScoreLabel(value)] : [String(value), "Number"];
  }

  if (typeof value === "boolean") {
    return [value ? "yes" : "no", "Flag"];
  }

  if (typeof value === "string") {
    return [truncateToWidth(value, 60), "Text"];
  }

  if (Array.isArray(value)) {
    return [`${value.length} ${value.length === 1 ? "item" : "items"}`, "Array"];
  }

  return [`${Object.keys(value).length} fields`, "Group"];
}

export function flattenMetricRows(
  metrics: unknown,
  prefix = "",
  depth = 0,
): Array<[string, string, string]> {
  if (metrics === null || typeof metrics !== "object") {
    return [];
  }

  const rows: Array<[string, string, string]> = [];

  for (const [key, value] of Object.entries(metrics)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const isGroup = value !== null && typeof value === "object" && !Array.isArray(value);

    if (isGroup && depth < MAX_METRIC_DEPTH) {
      const nested = flattenMetricRows(value, path, depth + 1);
      if (nested.length === 0) {
        rows.push([path, "—", "Empty"]);
        continue;
      }
      rows.push(...nested);
      continue;
    }

    const [display, note] = describeValue(key, value);
    rows.push([path, display, note]);
  }

  return rows;
}

export function renderDetailedMetricsTable(metrics: DetailedMetrics): string {
  if (!metrics || typeof metrics !== "object") {
    return brand.muted("No detailed metrics available for this repository yet.");
  }

  const rows = flattenMetricRows(metrics);
  if (rows.length === 0) {
    return brand.muted("No detailed metrics available for this repository yet.");
  }

  const table = createTable(["Metric", "Value", "Notes"]);
  for (const [path, value, note] of rows) {
    table.push([brand.highlight(path), pc.cyan(value), brand.muted(note)]);
  }
  return table.toString();
}

export function renderStructureMap(structure: StructureMap): string {
  if (
    !structure ||
    typeof structure !== "object" ||
    (Array.isArray(structure) && structure.length === 0)
  ) {
    return brand.muted("No structure map generated yet. Run `dxnx analyze start` first.");
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
  if (!results || typeof results !== "object" || (Array.isArray(results) && results.length === 0)) {
    return brand.muted(
      "No workspace matches. Try a different query, or run `dxnx analyze start` to refresh the index.",
    );
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

export function renderAuditResult(result: { jobId: string }, target: string, repo: string): string {
  const table = createTable(["Property", "Value"]);
  table.push(
    ["File", brand.highlight(target)],
    ["Repository", pc.cyan(repo)],
    ["Job ID", brand.highlight(result.jobId)],
  );

  const hints = brand.muted(
    `Poll for the report with: dxnx analyze status ${repo}\n` +
      `Pin the report into docs with: dxnx docs pin ${target} -r ${repo}`,
  );

  return renderBlock(brand.logo("Single-File Audit Queued"), `${table.toString()}\n\n${hints}`);
}
