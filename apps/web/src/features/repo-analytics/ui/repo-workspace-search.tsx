"use client";
import { useRef, useState } from "react";
import type { RepoSearchResult } from "@doxynix/shared";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Code2,
  FileSearch,
  MapPinned,
  Route as RouteIcon,
  type Search,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";

import { useTRPC } from "@/shared/api/trpc";
import { useRouter } from "@/shared/i18n/navigation";
import { useDebounce } from "@/shared/lib/hooks/use-debounce";
import { AppButton } from "@/shared/ui/core/button";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { AppSearch } from "@/shared/ui/kit/app-search";
import { SkeletonList, SkeletonText } from "@/shared/ui/kit/app-skeleton";

import { buildRepoSearchResultHref } from "@/entities/repo/model/repo-workspace-navigation";
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
  const trpc = useTRPC();
  const t = useTranslations("Dashboard");
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(false);
  const { aid, name, owner } = useRepoParams();
  const [search] = useQueryState("search", parseAsString.withDefault(""));
  const debouncedSearch = useDebounce(search, 300);

  const [prevSearch, setPrevSearch] = useState(debouncedSearch);
  if (debouncedSearch !== prevSearch) {
    setPrevSearch(debouncedSearch);
    if (debouncedSearch.trim().length >= 2) {
      setIsVisible(true);
    }
  }

  const trimmedSearch = debouncedSearch.trim();
  const isQueryEnabled = trimmedSearch.length >= 2;

  const { data, isFetching } = useQuery(
    trpc.analysis.searchWorkspace.queryOptions(
      { aid: aid ?? undefined, repoId, search: trimmedSearch },
      {
        enabled: isQueryEnabled,
      },
    ),
  );

  const getEmptyLabel = () => {
    if (!isQueryEnabled) {
      return t("workspace_search_hint");
    }
    if (isFetching) {
      return null;
    }
    return t("workspace_search_empty");
  };

  const emptyLabel = getEmptyLabel();
  const hasResults = (data?.length ?? 0) > 0;

  return (
    <div
      className="relative w-full"
      ref={containerRef}
    >
      <div
        onClickCapture={() => setIsVisible(true)}
        onFocusCapture={() => setIsVisible(true)}
      >
        <AppSearch placeholder={t("workspace_search_placeholder")} />
      </div>

      {isVisible && isQueryEnabled && (
        <div className="absolute z-20 mt-2 w-full rounded-lg border bg-card">
          <div className="flex max-h-80 flex-col overflow-y-auto p-2">
            {isFetching && !hasResults ? (
              <SkeletonList
                className="flex flex-col"
                count={3}
                itemClassName="flex items-start gap-3 px-2 py-2"
                renderItem={() => (
                  <>
                    <Skeleton className="mt-0.5 size-4 shrink-0" />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <SkeletonText
                        lines={1}
                        widths={["w-full"]}
                      />
                      <SkeletonText
                        lines={1}
                        size="sm"
                        widths={["w-2/3"]}
                      />
                    </div>
                  </>
                )}
              />
            ) : hasResults ? (
              data?.map((result) => {
                const Icon = RESULT_ICONS[result.kind];

                return (
                  <AppButton
                    className="h-auto items-start justify-start px-2 py-2 text-left"
                    key={result.id}
                    onClick={() => {
                      setIsVisible(false);
                      router.push(
                        buildRepoSearchResultHref({
                          aid,
                          name,
                          owner,
                          result,
                        }),
                      );
                    }}
                    variant="ghost"
                  >
                    <div className="flex items-start gap-3">
                      <Icon className="mt-0.5" />
                      <div className="min-w-0">
                        <div className="truncate text-sm">{result.label}</div>
                        <div className="truncate text-muted-foreground text-xs">
                          {result.description}
                        </div>
                      </div>
                    </div>
                  </AppButton>
                );
              })
            ) : emptyLabel != null ? (
              <div className="px-3 py-4 text-muted-foreground text-sm">{emptyLabel}</div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
