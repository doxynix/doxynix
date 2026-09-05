import { brand, pc } from "@/ui/colors";
import { createTable } from "@/ui/table";

const range1 = "\\x00-\\x1F";
const range2 = "\\x7F-\\x9F";
const CONTROL_CHARS_REGEX = new RegExp(`[${range1}${range2}]`, "g");

export function sanitizePath(raw: string): string {
  return raw.replaceAll(CONTROL_CHARS_REGEX, "");
}

export function renderGithubReposTable(repos: any[]): string {
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

  const table = createTable(["Type", "Path", "SHA / Size"]);

  for (const file of files) {
    let filePath = "";
    let isDir = false;
    let extraInfo = "—";

    if (Array.isArray(file)) {
      filePath = sanitizePath(String(file[0] ?? ""));
      const isFile = file[1] === true || file[1] === 1;
      isDir = !isFile;
      extraInfo = file[2] ? brand.muted(String(file[2]).slice(0, 7)) : "—";
    } else {
      filePath = sanitizePath(file.path ?? "");
      isDir = file.type === "dir" || file.type === "tree";
      extraInfo = file.size ? brand.muted(`${file.size} B`) : "—";
    }

    const icon = isDir ? "📁" : "📄";
    const typeLabel = isDir ? pc.cyan("Directory") : pc.gray("File");

    table.push([`${icon} ${typeLabel}`, isDir ? pc.bold(filePath) : filePath, extraInfo]);
  }

  return table.toString();
}
