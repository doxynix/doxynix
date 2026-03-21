"use client";

import { trpc } from "@/shared/api/trpc";
import { Skeleton } from "@/shared/ui/core/skeleton";

import { RepoOverview } from "@/entities/repo-details";

type Props = { id: string };

export function RepoOverviewContainer({ id }: Readonly<Props>) {
  const { data, isLoading } = trpc.repoDetails.getOverview.useQuery({
    repoId: id,
  });

  if (isLoading || !data) {
    return (
      <>
        <Skeleton className="mb-4 ml-auto h-5 w-24 text-sm" />
      </>
    );
  }

  return (
    <>
      <div>
        <RepoOverview data={data} />
      </div>
    </>
  );
}
