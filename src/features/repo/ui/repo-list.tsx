"use client";

import { SearchX } from "lucide-react";
import { useTranslations } from "next-intl";

import type { RepoMeta, UiRepoListItem } from "@/shared/api/trpc";
import { Button } from "@/shared/ui/core/button";
import { EmptyState } from "@/shared/ui/kit/empty-state";

import { useCreateRepoActions } from "@/entities/repo/model/use-create-repo-dialog.store";
import { RepoCard } from "@/entities/repo/ui/repo-card";

type Props = {
  meta?: RepoMeta;
  repos: UiRepoListItem[];
};

export function RepoList({ meta, repos }: Readonly<Props>) {
  const { setOpen } = useCreateRepoActions();
  const t = useTranslations("Dashboard");
  const tCommon = useTranslations("Common");

  if (!meta || meta.totalCount === 0) {
    return (
      <EmptyState
        action={
          <Button variant="secondary" onClick={() => setOpen(true)} className="cursor-pointer">
            {tCommon("add")}
          </Button>
        }
        description={t("repo_empty_repos_desc")}
        title={t("repo_empty_title")}
      />
    );
  }

  if (meta.filteredCount === 0) {
    return (
      <EmptyState
        description={
          meta.searchQuery !== "" && meta.searchQuery != null ? (
            <span>
              {t("repo_no_results_found_for")}{" "}
              <span className="italic">{`"${meta.searchQuery}"`}</span>
            </span>
          ) : (
            t("repo_change_filters")
          )
        }
        icon={SearchX}
        title={t("repo_no_results_found")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {repos.map((repo) => (
        <RepoCard key={repo.id} repo={repo} />
      ))}
    </div>
  );
}
