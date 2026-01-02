import { SearchX } from "lucide-react";

import { RepoEmpty } from "@/features/repo";

import { RepoCard } from "@/entities/repo";
import { RepoMeta, RepoTableItem } from "@/entities/repo/model/types";

interface RepoListProps {
  repos: RepoTableItem[];
  meta?: RepoMeta;
}

export function RepoList({ repos, meta }: RepoListProps) {
  if (!meta || meta.totalCount === 0) {
    return <RepoEmpty />;
  }

  if (meta.filteredCount === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-full">
          <SearchX className="text-muted-foreground h-6 w-6" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">Ничего не найдено</h3>
        <div className="text-muted-foreground mt-2 mb-4 text-sm">
          {meta.searchQuery !== "" && meta.searchQuery !== null ? (
            <span>
              По запросу <span className="italic">{`"${meta.searchQuery}"`}</span> ничего не
              нашлось.
            </span>
          ) : (
            <span>Попробуйте изменить параметры фильтра.</span>
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
