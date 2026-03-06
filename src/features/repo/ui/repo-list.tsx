"use client";

import type { RepoMeta, UiRepoListItem } from "@/shared/api/trpc";

import { RepoCard } from "@/entities/repo";

import { RepoEmpty } from "./repo-empty";
import { RepoSearchEmpty } from "./repo-search-empty";

type Props = {
  meta?: RepoMeta;
  repos: UiRepoListItem[];
};

export function RepoList({ meta, repos }: Readonly<Props>) {
  if (!meta || meta.totalCount === 0) {
    return <RepoEmpty />;
  }

  if (meta.filteredCount === 0) {
    return <RepoSearchEmpty meta={meta} />;
  }

  return (
    <div className="flex flex-col gap-4">
      {repos.map((repo) => (
        <RepoCard key={repo.id} repo={repo} />
      ))}
    </div>
  );
}
