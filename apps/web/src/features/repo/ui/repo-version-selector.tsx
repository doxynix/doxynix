"use client";
import { useQuery } from "@tanstack/react-query";
import { GitCommit } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";

import { useTRPC } from "@/shared/api/trpc";
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

type Props = { repoId: string };

export function RepoVersionSelector({ repoId }: Readonly<Props>) {
  const trpc = useTRPC();
  const locale = useLocale();
  const tCommon = useTranslations("Common");
  const t = useTranslations("Dashboard");
  const [selectedAid, setAid] = useQueryState("aid", parseAsString.withDefault(""));

  const { data: history, isLoading } = useQuery(trpc.analysis.getHistory.queryOptions({ repoId }));

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

  const { capped, items, total } = history;

  if (items.length === 0) {
    return null;
  }

  return (
    <Select
      onValueChange={(e) => void setAid(e)}
      value={selectedAid || items[0]?.id}
    >
      <SelectTrigger
        aria-label={t("repo_version_placeholder")}
        className="w-60"
      >
        <GitCommit />
        <SelectValue placeholder={t("repo_version_placeholder")} />
        {capped && (
          <span className="ml-auto text-muted-foreground text-xs">
            {t("repo_version_capped", { shown: items.length, total })}
          </span>
        )}
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem
            disabled={item.status === "FAILED"}
            key={item.id}
            value={item.id}
          >
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
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
