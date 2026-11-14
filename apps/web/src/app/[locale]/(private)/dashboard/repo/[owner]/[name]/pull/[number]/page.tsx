import { Suspense } from "react";
import { notFound } from "next/navigation";

import { createRepoMetadata } from "@/shared/lib/metadata";

import { RepoPullDetailContainer } from "@/features/repo-pulls/ui/repo-pull-details-container";
import { RepoPullDetailsSkeleton } from "@/features/repo-pulls/ui/repo-pull-details-skeleton";

import { HydrateClient, prefetch, trpcProxy } from "@/server/core/trpc/prefetch";
import { repoFetchers } from "@/server/modules/repos/repo.fetchers";

type Props = {
  params: Promise<{ name: string; number: string; owner: string }>;
};

export const generateMetadata = createRepoMetadata("pull_detail");

export default async function PullRequestDetailPage({ params }: Readonly<Props>) {
  const { name, number, owner } = await params;

  if (!/^\d+$/.test(number)) {
    notFound();
  }

  const prNumber = Number.parseInt(number, 10);

  if (!Number.isSafeInteger(prNumber) || prNumber <= 0) {
    notFound();
  }

  const repo = await repoFetchers.getRepoOrNotFound(owner, name);

  return (
    <Suspense fallback={<RepoPullDetailsSkeleton />}>
      <PullDetailSection
        name={name}
        owner={owner}
        prNumber={prNumber}
        repoId={repo.id}
      />
    </Suspense>
  );
}

async function PullDetailSection({
  name,
  owner,
  prNumber,
  repoId,
}: Readonly<{
  name: string;
  owner: string;
  prNumber: number;
  repoId: string;
}>) {
  await prefetch(trpcProxy.analysis.getByPRNumber.queryOptions({ prNumber, repoId }));

  return (
    <HydrateClient>
      <RepoPullDetailContainer
        name={name}
        owner={owner}
        prNumber={prNumber}
        repoId={repoId}
      />
    </HydrateClient>
  );
}
