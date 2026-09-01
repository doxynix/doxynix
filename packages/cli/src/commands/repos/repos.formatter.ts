import type { RouterOutput } from "@/core/client";

import { brand, pc } from "@/ui/colors";
import { formatScore } from "@/ui/formatters";
import { createTable } from "@/ui/table";

export type RepoListItem = RouterOutput["repo"]["getAll"]["items"][number];
export type RepoDetails = NonNullable<RouterOutput["repo"]["getByName"]>;

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
      pc.yellow(`★ ${r.stars}`),
      brand.muted(r.defaultBranch),
    ]);
  }

  return table.toString();
}

export function renderRepoDetails(repo: RepoDetails): void {
  console.log(`\n  📦 ${brand.highlight(`${repo.owner}/${repo.name}`)}`);
  console.log(`  Description:  ${brand.muted(repo.description ?? "No description provided")}`);
  console.log(`  Language:     ${pc.cyan(repo.language ?? "Unknown")}`);
  console.log(`  License:      ${brand.info(repo.license ?? "None")}`);
  console.log(`  URL:          ${brand.muted(repo.url)}`);
  console.log(`  Branch:       ${brand.highlight(repo.defaultBranch)}`);
  console.log(`  Stars/Forks:  ★ ${repo.stars} / ⑂ ${repo.forks}`);
  console.log(`  ID (UUID):    ${brand.muted(repo.id)}\n`);
}
