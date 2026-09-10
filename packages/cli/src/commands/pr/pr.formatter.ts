import { brand, pc } from "@/ui/colors";
import { formatScore, stripHtml } from "@/ui/formatters";
import { createTable } from "@/ui/table";

import { formatStatus } from "../analyze/analyze.formatter";
import type {
  FixItem,
  PRAnalysisDetails,
  PRCommentItem,
  PRImpactDetails,
  PRListItem,
} from "./pr.types";

export function renderPRListTable(prs: PRListItem[]): string {
  const table = createTable(["PR #", "Risk Score", "Findings", "Status", "Head Commit"]);

  for (const pr of prs) {
    const statusLabel =
      pr.status === "COMPLETED"
        ? brand.success("✔ Completed")
        : pr.status === "FAILED"
          ? brand.error("✖ Failed")
          : brand.info("⏳ Analyzing");

    table.push([
      brand.highlight(`#${pr.prNumber}`),
      formatScore(pr.riskScore),
      pr.findingCount !== undefined ? pc.yellow(String(pr.findingCount)) : brand.muted("0"),
      statusLabel,
      pr.headSha ? brand.muted(pr.headSha.slice(0, 7)) : "—",
    ]);
  }

  return table.toString();
}

export function renderFixesTable(fixes: FixItem[]): string {
  const table = createTable(["Fix ID", "Title", "Branch", "Status", "Created"]);

  for (const fix of fixes) {
    const id = fix.id ? `${fix.id.slice(0, 8)}...` : "—";
    const status =
      fix.status === "PR_OPENED"
        ? brand.success("PR Opened")
        : fix.status === "FAILED"
          ? brand.error("Failed")
          : brand.info(fix.status ?? "PENDING");

    table.push([
      brand.muted(id),
      brand.highlight(fix.title ?? "AI Suggested Fix"),
      pc.cyan(fix.branch ?? "—"),
      status,
      new Date(fix.createdAt).toLocaleDateString(),
    ]);
  }

  return table.toString();
}

export function renderPRCommentsTable(comments: PRCommentItem[]): string {
  const table = createTable(["File & Line", "Type", "Risk Level", "AI Finding / Suggestion"]);

  for (const c of comments) {
    const location = `${brand.highlight(c.filePath)}:${pc.yellow(String(c.line || 1))}`;
    const typeLabel =
      c.findingType === "SECURITY_FLAW"
        ? brand.error(c.findingType)
        : c.findingType === "BUG"
          ? brand.warning(c.findingType)
          : brand.info(c.findingType || "REVIEW");

    const cleanBody = stripHtml(c.bodyHtml);
    const bodyPreview = cleanBody.length > 70 ? `${cleanBody.slice(0, 67)}...` : cleanBody;

    table.push([location, typeLabel, formatScore(c.riskLevel), brand.muted(bodyPreview)]);
  }

  return table.toString();
}

export function renderPRAnalysisDetails(analysis: PRAnalysisDetails): string {
  const table = createTable(["Property", "Value"]);

  table.push(
    ["PR Number", brand.highlight(`#${analysis.prNumber}`)],
    ["Status", formatStatus(analysis.status)],
    ["Risk Score", formatScore(analysis.riskScore)],
    ["Head Commit", brand.info(analysis.headSha ? analysis.headSha.slice(0, 7) : "—")],
    ["Base Commit", brand.muted(analysis.baseSha ? analysis.baseSha.slice(0, 7) : "—")],
    ["Created At", brand.muted(new Date(analysis.createdAt).toLocaleString())],
    ["Analysis ID", brand.muted(analysis.publicId)],
  );

  if (analysis.error) {
    table.push(["Error Details", brand.error(analysis.error)]);
  }

  return table.toString();
}

export function renderPRImpactDetails(impact: NonNullable<PRImpactDetails>): string {
  const table = createTable(["Metric", "Assessment"]);

  const affectedCount = impact.affectedNodes?.length ?? 0;
  const topFindingsCount = impact.topFindings?.length ?? 0;

  table.push(
    ["Affected Modules / Nodes", brand.highlight(String(affectedCount))],
    ["Detected Security Findings", pc.yellow(String(topFindingsCount))],
  );

  return table.toString();
}
