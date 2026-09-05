import { brand, pc } from "@/ui/colors";
import { formatScore } from "@/ui/formatters";
import { createTable } from "@/ui/table";

export function renderPRListTable(prs: any[]): string {
  const table = createTable(["PR #", "Risk Score", "Findings", "Status", "Head Commit"]);

  for (const pr of prs) {
    const statusLabel =
      pr.status === "DONE" || pr.status === "COMPLETED"
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

export function renderFixesTable(fixes: any[]): string {
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
