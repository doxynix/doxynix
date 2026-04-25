"use client";

import { HistoryIcon } from "lucide-react";

import { trpc } from "@/shared/api/trpc";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { EmptyState } from "@/shared/ui/kit/empty-state";

import { useRepoParams } from "@/entities/repo/model/use-repo-params";
import { RepoAnalyzeButton } from "@/entities/repo/ui/repo-analyze-button";

import { RepoHistory } from "./repo-history";

type Props = { id: string };

export function RepoHistoryContainer({ id }: Readonly<Props>) {
  const { name, owner } = useRepoParams();

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
      <div className="flex h-150 items-center justify-center rounded-xl border border-dashed">
        <EmptyState
          action={<RepoAnalyzeButton name={name} owner={owner} />}
          description="We haven't tracked any analysis runs for this repository yet."
          icon={HistoryIcon}
          title="Analysis history is empty"
        />
      </div>
    );
  }

  return <RepoHistory history={data} />;
}
