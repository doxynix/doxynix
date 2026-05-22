"use client";

import { GitCommit } from "lucide-react";
import { useLocale } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";

import { trpc } from "@/shared/api/trpc";
import { AppBadge } from "@/shared/ui/core/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/core/select";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { TimeAgo } from "@/shared/ui/kit/time-ago";

type Props = { repoId: string };

export function RepoVersionSelector({ repoId }: Readonly<Props>) {
  const locale = useLocale();
  const [selectedAid, setAid] = useQueryState("aid", parseAsString.withDefault(""));

  const { data: history, isLoading } = trpc.analysis.getHistory.useQuery({ repoId });

  if (isLoading || history == null) return <Skeleton className="h-9 w-60" />;

  return (
    <Select value={selectedAid || history[0]?.id} onValueChange={(e) => void setAid(e)}>
      <SelectTrigger className="w-60">
        <GitCommit />
        <SelectValue placeholder="Select version" />
      </SelectTrigger>
      <SelectContent>
        {history.map((item) => (
          <SelectItem key={item.id} disabled={item.status === "FAILED"} value={item.id}>
            <div className="flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-2 font-medium">
                <span className="max-w-30 truncate">
                  {item.commitSha?.slice(0, 7) ?? "Unknown"}
                </span>
              </div>
              <TimeAgo date={item.createdAt} locale={locale} className="ml-auto text-xs" />
              {item.status === "FAILED" && (
                <AppBadge variant="outline" className="text-destructive text-xs">
                  Failed
                </AppBadge>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
