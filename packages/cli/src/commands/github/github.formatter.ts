import { brand, pc } from "@/ui/colors";
import { createTable } from "@/ui/table";

import type { GithubRepoItem } from "./github.service";

export function renderGithubReposTable(repos: GithubRepoItem[]): string {
  const table = createTable(["Repository", "Visibility", "Branch", "Description"]);

  for (const r of repos) {
    const fullName = r.fullName ?? `${r.owner}/${r.name}`;
    const isPriv = r.isPrivate ?? r.private;
    const branch = r.defaultBranch ?? "main";
    const desc = r.description
      ? r.description.slice(0, 45) + (r.description.length > 45 ? "…" : "")
      : "—";

    table.push([
      brand.highlight(fullName),
      isPriv ? pc.yellow("🔒 Private") : pc.green("🌐 Public"),
      pc.cyan(branch),
      brand.muted(desc),
    ]);
  }

  return table.toString();
}

export function renderBranchesTable(branches: any[]): string {
  const table = createTable(["Branch Name", "Protected / Status", "Latest Commit"]);

  for (const b of branches) {
    const name = typeof b === "string" ? b : b.name;
    const isProtected = b.protected ? pc.yellow("🛡️ Protected") : brand.muted("Standard");
    const commitSha = b.commit?.sha ? brand.muted(b.commit.sha.slice(0, 7)) : "—";

    table.push([brand.highlight(name), isProtected, commitSha]);
  }

  return table.toString();
}

export function renderFileTree(files: any[]): string {
  if (!files || files.length === 0) {
    return brand.muted("Directory is empty.");
  }

  const table = createTable(["Type", "Path", "Size"]);

  for (const file of files) {
    const isDir = file.type === "dir" || file.type === "tree";
    const icon = isDir ? "📁" : "📄";
    const typeLabel = isDir ? pc.cyan("Directory") : pc.gray("File");
    const size = file.size ? brand.muted(`${file.size} B`) : brand.muted("—");

    table.push([`${icon} ${typeLabel}`, isDir ? pc.bold(file.path) : file.path, size]);
  }

  return table.toString();
}
