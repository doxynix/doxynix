"use client";

import { HistoryIcon } from "lucide-react";

import { trpc } from "@/shared/api/trpc";
import { Skeleton } from "@/shared/ui/core/skeleton";

import { RepoHistory } from "./repo-history";

type Props = { id: string };

export function RepoHistoryContainer({ id }: Readonly<Props>) {
  const { data, isLoading } = trpc.repoDetails.getHistory.useQuery({
    repoId: id,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-100" />
        <Skeleton className="h-125 w-full" />
      </div>
    );
  }

  if (data == null || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-20 text-center">
        <HistoryIcon className="text-muted-foreground mb-4 size-12 opacity-20" />
        <h3 className="text-lg font-medium">No history found</h3>
        <p className="text-muted-foreground text-sm">Run a full analysis to generate docs.</p>
      </div>
    );
  }

  return <RepoHistory history={data} />;
}
