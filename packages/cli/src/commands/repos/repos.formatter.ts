import { brand, pc } from "@/ui/colors";
import { formatScore } from "@/ui/formatters";
import { icons } from "@/ui/icons";
import { renderCard } from "@/ui/layout";
import { createTable } from "@/ui/table";

import type { RepoDetails, RepoListItem } from "./repos.types";

export function renderReposTable(items: RepoListItem[]): string {
  const table = createTable([
    "ID",
    "Repository",
    "Language",
    "Security",
    "Stars",
    "Default Branch",
  ]);

  for (const r of items) {
    table.push([
      brand.muted(`${r.id.slice(0, 8)}...`),
      brand.highlight(`${r.owner}/${r.name}`),
      r.language ? pc.cyan(r.language) : brand.muted("—"),
      formatScore(r.securityScore),
      pc.yellow(`${icons.star} ${r.stars}`),
      brand.muted(r.defaultBranch),
    ]);
  }

  return table.toString();
}

export function renderRepoDetails(repo: RepoDetails): void {
  const repoTarget = `${repo.owner}/${repo.name}`;
  console.log(
    renderCard(`[Repo] ${brand.highlight(repoTarget)}`, [
      ["Description", brand.muted(repo.description ?? "No description provided")],
      ["Language", pc.cyan(repo.language ?? "Unknown")],
      ["License", brand.info(repo.license ?? "None")],
      ["URL", brand.muted(repo.url)],
      ["Branch", brand.highlight(repo.defaultBranch)],
      ["Stars / Forks", `${icons.star} ${repo.stars} / ${icons.branch} ${repo.forks}`],
      ["ID (UUID)", brand.muted(repo.id)],
    ]),
  );
}

export function renderSlimReposTable(
  items: Array<{ avatar: string | null; id: string; name: string; owner: string }>,
): string {
  const table = createTable(["ID (UUID)", "Repository (Target)", "Avatar URL"]);

  for (const r of items) {
    table.push([
      brand.muted(`${r.id.slice(0, 8)}...`),
      brand.highlight(`${r.owner}/${r.name}`),
      r.avatar
        ? brand.muted(r.avatar.slice(0, 45) + (r.avatar.length > 45 ? "…" : ""))
        : brand.muted("—"),
    ]);
  }

  return table.toString();
}
