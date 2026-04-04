"use client";

import { BarChart3 } from "lucide-react";

import { trpc } from "@/shared/api/trpc";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { EmptyState } from "@/shared/ui/kit/empty-state";

import { RepoAnalyzeButton, useRepoParams } from "@/entities/repo";

import { RepoOverview } from "./repo-overview";

type Props = { id: string };

export function RepoOverviewContainer({ id }: Readonly<Props>) {
  const { name, owner } = useRepoParams();
  const { data, isLoading } = trpc.repoDetails.getOverview.useQuery({
    repoId: id,
  });

  if (isLoading) {
    return <Skeleton className="mb-4 ml-auto h-150 w-full text-sm" />;
  }

  if (data == null) {
    return (
      <div className="flex h-150 items-center justify-center rounded-xl border border-dashed">
        <EmptyState
          action={<RepoAnalyzeButton name={name} owner={owner} />}
          description="Run a full analysis to generate insights and overview."
          icon={BarChart3}
          title="No analysis found"
        />
      </div>
    );
  }

  return <RepoOverview data={data} />;
}
