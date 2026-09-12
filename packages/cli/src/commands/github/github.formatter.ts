import { brand, pc } from "@/ui/colors";
import { icons } from "@/ui/icons";
import { createTable } from "@/ui/table";

import type {
  GitHubBranchItem,
  GitHubFileItem,
  GitHubRepoItem,
} from "@/commands/github/github.types";

const range1 = "\\x00-\\x1F";
const range2 = "\\x7F-\\x9F";
const CONTROL_CHARS_REGEX = new RegExp(`[${range1}${range2}]`, "g");

export function sanitizePath(raw: string): string {
  return raw.replaceAll(CONTROL_CHARS_REGEX, "");
}

export function renderGithubReposTable(repos: GitHubRepoItem[]): string {
  const table = createTable(["Repository", "Visibility", "Branch", "Description"]);

  for (const r of repos) {
    const fullName = r.fullName;
    const isPriv = Boolean("private" in r && r.private);
    const branch =
      "default_branch" in r && typeof r.default_branch === "string" ? r.default_branch : "main";
    const desc = r.description
      ? r.description.slice(0, 45) + (r.description.length > 45 ? "…" : "")
      : "—";

    const visibilityLabel = isPriv ? `${icons.lock} Private` : `${icons.dotMuted} Public`;

    table.push([
      brand.highlight(fullName),
      isPriv ? pc.yellow(visibilityLabel) : pc.green(visibilityLabel),
      pc.cyan(branch),
      brand.muted(desc),
    ]);
  }

  return table.toString();
}

export function renderBranchesTable(branches: GitHubBranchItem[]): string {
  const table = createTable(["Branch Name", "Status"]);

  for (const b of branches) {
    table.push([brand.highlight(`${icons.branch} ${b}`), brand.muted("Active")]);
  }

  return table.toString();
}

export function renderFileTree(files: GitHubFileItem[]): string {
  if (!files || files.length === 0) {
    return brand.muted("Directory is empty.");
  }

  const table = createTable(["Type", "Path", "SHA / Size"]);

  for (const file of files) {
    const filePath = sanitizePath(String(file[0] ?? ""));
    const isFile = file[1] === 1;
    const isDir = !isFile;
    const extraInfo = file[2] ? brand.muted(String(file[2]).slice(0, 7)) : "—";

    const icon = isDir ? icons.folder : icons.doc;
    const typeLabel = isDir ? pc.cyan("Directory") : pc.gray("File");

    table.push([`${icon} ${typeLabel}`, isDir ? pc.bold(filePath) : filePath, extraInfo]);
  }

  return table.toString();
}
