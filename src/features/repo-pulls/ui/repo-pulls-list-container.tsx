"use client";

import { trpc } from "@/shared/api/trpc";
import { EmptyState } from "@/shared/ui/kit/empty-state";

import { RepoPullsList } from "./repo-pulls-list";

type Props = { name: string; owner: string; repoId: string };

export function RepoPullsListContainer({ name, owner, repoId }: Readonly<Props>) {
  const { data: pulls, isLoading } = trpc.prAnalysis.listByRepository.useQuery({
    repoId,
  });

  if (isLoading) return <div>Loading...</div>;

  if (pulls == null) {
    return <EmptyState description={<p>Empty</p>} title="Empty" />;
  }

  return <RepoPullsList name={name} owner={owner} pulls={pulls} />;
}
