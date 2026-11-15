"use client";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { GitCommit } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";

import { useTRPC } from "@/shared/api/trpc";
import { REPO_ANALYSIS_PAGE_SIZE } from "@/shared/config/repos";
import { AppBadge } from "@/shared/ui/core/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/core/select";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { SkeletonText } from "@/shared/ui/kit/app-skeleton";
import { TimeAgo } from "@/shared/ui/kit/time-ago";

const LOAD_MORE = "__load_more__";

type VersionRef = {
  commitSha: string | null;
  createdAt: Date;
  id: string;
  status: string;
};

type Props = { repoId: string };

export function RepoVersionSelector({ repoId }: Readonly<Props>) {
  const trpc = useTRPC();
  const locale = useLocale();
  const tCommon = useTranslations("Common");
  const t = useTranslations("Dashboard");
  const [selectedAid, setAid] = useQueryState("aid", parseAsString.withDefault(""));

  const {
    data: history,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery(
    trpc.analysis.getHistory.infiniteQueryOptions(
      { limit: REPO_ANALYSIS_PAGE_SIZE, repoId },
      { getNextPageParam: (page) => page.meta.nextCursor },
    ),
  );

  const items = history?.pages.flatMap((page) => page.items) ?? [];
  const pinnedInPage = selectedAid !== "" && items.some((item) => item.id === selectedAid);

  // A version pinned from an old link can sit past the first page, so its label has to come from
  // a single-row read instead of the loaded pages.
  const { data: pinnedRef } = useQuery(
    trpc.analysis.getVersionRef.queryOptions(
      { analysisId: selectedAid, repoId },
      { enabled: selectedAid !== "" && history != null && !pinnedInPage },
    ),
  );

  const pinnedVersion = pinnedInPage ? undefined : pinnedRef;

  function renderVersion(item: VersionRef) {
    return (
      <div className="flex items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2 font-medium">
          <span className="max-w-30 truncate">
            {item.commitSha?.slice(0, 7) ?? t("repo_version_unknown")}
          </span>
        </div>
        <TimeAgo
          className="ml-auto text-xs"
          date={item.createdAt}
          locale={locale}
        />
        {item.status === "FAILED" && (
          <AppBadge
            className="text-destructive text-xs"
            variant="outline"
          >
            {tCommon("failed")}
          </AppBadge>
        )}
      </div>
    );
  }

  if (isLoading || history == null) {
    return (
      <div className="flex h-9 w-60 items-center justify-between gap-2 rounded-xl border border-input bg-background/80 px-3">
        <div className="flex min-w-0 items-center gap-2">
          <Skeleton className="size-4 shrink-0" />
          <SkeletonText
            className="min-w-0 flex-1"
            lines={1}
            widths={["w-24"]}
          />
        </div>
        <Skeleton className="size-4 shrink-0" />
      </div>
    );
  }

  const total = history.pages[0]?.total ?? 0;

  if (items.length === 0 && pinnedVersion == null) {
    return null;
  }

  return (
    <Select
      onValueChange={(value) => {
        if (value === LOAD_MORE) {
          void fetchNextPage();
          return;
        }
        void setAid(value);
      }}
      value={selectedAid || items[0]?.id}
    >
      <SelectTrigger
        aria-label={t("repo_version_placeholder")}
        className="w-60"
      >
        <GitCommit />
        <SelectValue placeholder={t("repo_version_placeholder")} />
        {total > items.length && (
          <span className="ml-auto text-muted-foreground text-xs">
            {t("repo_version_capped", { shown: items.length, total })}
          </span>
        )}
      </SelectTrigger>
      <SelectContent>
        {pinnedVersion != null && (
          <SelectItem
            disabled={pinnedVersion.status === "FAILED"}
            value={pinnedVersion.id}
          >
            {renderVersion(pinnedVersion)}
          </SelectItem>
        )}
        {items.map((item) => (
          <SelectItem
            disabled={item.status === "FAILED"}
            key={item.id}
            value={item.id}
          >
            {renderVersion(item)}
          </SelectItem>
        ))}
        {hasNextPage && (
          <SelectItem
            disabled={isFetchingNextPage}
            value={LOAD_MORE}
          >
            <span className="text-muted-foreground text-xs">
              {isFetchingNextPage ? tCommon("loading") : tCommon("more")}
            </span>
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}
