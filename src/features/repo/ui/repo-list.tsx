"use client";

import { SearchX } from "lucide-react";
import { useTranslations } from "next-intl";

import { RepoMeta, RepoTableItem } from "@/shared/types/repo";

import { RepoCard } from "@/entities/repo";
import { RepoEmpty } from "./repo-empty";

type Props = {
  repos: RepoTableItem[];
  meta?: RepoMeta;
};

export function RepoList({ repos, meta }: Props) {
  const t = useTranslations("Dashboard");

  if (!meta || meta.totalCount === 0) {
    return <RepoEmpty />;
  }

  if (meta.filteredCount === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-full">
          <SearchX className="text-muted-foreground h-6 w-6" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">{t("repo_no_results_found")}</h3>
        <div className="text-muted-foreground mt-2 mb-4 text-sm">
          {meta.searchQuery !== "" && meta.searchQuery !== null ? (
            <span>
              {t("repo_no_results_found_for")}{" "}
              <span className="italic">{`"${meta.searchQuery}"`}</span>
            </span>
          ) : (
            <span>{t("repo_change_filters")}</span>
          )}
        </div>
      </div>
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
