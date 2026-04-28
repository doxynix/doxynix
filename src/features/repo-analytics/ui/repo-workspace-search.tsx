"use client";

import { useRef, useState } from "react";
import {
  BookOpen,
  Code2,
  FileSearch,
  MapPinned,
  Route as RouteIcon,
  type Search,
} from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";

import { trpc, type RepoSearchResult } from "@/shared/api/trpc";
import { Button } from "@/shared/ui/core/button";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { AppSearch } from "@/shared/ui/kit/app-search";
import { useRouter } from "@/i18n/routing";

import { buildRepoSearchResultHref } from "@/entities/repo-details/model/repo-workspace-navigation";
import { useRepoParams } from "@/entities/repo/model/use-repo-params";

const RESULT_ICONS = {
  "doc-section": BookOpen,
  entrypoint: RouteIcon,
  file: Code2,
  node: MapPinned,
  route: FileSearch,
} satisfies Record<RepoSearchResult["kind"], typeof Search>;

type Props = {
  repoId: string;
};

export function RepoWorkspaceSearch({ repoId }: Readonly<Props>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(false);
  const { name, owner } = useRepoParams();
  const [search] = useQueryState(
    "search",
    parseAsString.withDefault("").withOptions({ shallow: true })
  );

  const [prevSearch, setPrevSearch] = useState(search);
  if (search !== prevSearch) {
    setPrevSearch(search);
    if (search.trim().length >= 2) {
      setIsVisible(true);
    }
  }

  const trimmedSearch = search.trim();
  const isQueryEnabled = trimmedSearch.length >= 2;

  const { data, isFetching } = trpc.repoDetails.searchWorkspace.useQuery(
    { repoId, search: trimmedSearch },
    {
      enabled: isQueryEnabled,
    }
  );

  const getEmptyLabel = () => {
    if (!isQueryEnabled) return "Search files, nodes, routes, and doc sections";
    if (isFetching) return null;
    return "No structural matches found";
  };

  const emptyLabel = getEmptyLabel();
  const hasResults = (data?.length ?? 0) > 0;

  return (
    <div ref={containerRef} className="relative w-full">
      <div onClickCapture={() => setIsVisible(true)} onFocusCapture={() => setIsVisible(true)}>
        <AppSearch placeholder="Search workspace..." />
      </div>

      {isVisible && isQueryEnabled && (
        <div className="bg-card absolute z-20 mt-2 w-full rounded-lg border">
          <div className="flex max-h-80 flex-col overflow-y-auto p-2">
            {isFetching && !hasResults ? (
              <div className="space-y-2 p-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            ) : hasResults ? (
              data?.map((result) => {
                const Icon = RESULT_ICONS[result.kind];

                return (
                  <Button
                    key={result.id}
                    variant="ghost"
                    onClick={() => {
                      setIsVisible(false);
                      void router.push(
                        buildRepoSearchResultHref({
                          name,
                          owner,
                          result,
                        })
                      );
                    }}
                    className="h-auto items-start justify-start px-2 py-2 text-left"
                  >
                    <div className="flex items-start gap-3">
                      <Icon className="mt-0.5" />
                      <div className="min-w-0">
                        <div className="truncate text-sm">{result.label}</div>
                        <div className="text-muted-foreground truncate text-xs">
                          {result.description}
                        </div>
                      </div>
                    </div>
                  </Button>
                );
              })
            ) : emptyLabel != null ? (
              <div className="text-muted-foreground px-3 py-4 text-sm">{emptyLabel}</div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
