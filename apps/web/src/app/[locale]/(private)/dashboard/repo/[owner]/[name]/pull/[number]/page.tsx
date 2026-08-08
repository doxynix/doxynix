import { notFound } from "next/navigation";

import { RepoPullDetailContainer } from "@/features/repo-pulls/ui/repo-pull-details-container";

import { repoFetchers } from "@/server/modules/repos/repo.fetchers";

type Props = {
  params: Promise<{ name: string; number: string; owner: string }>;
};

export default async function PullRequestDetailPage({ params }: Readonly<Props>) {
  const { name, number, owner } = await params;

  if (!/^\d+$/.test(number)) {
    notFound();
  }

  const prNumber = Number.parseInt(number, 10);

  if (!Number.isSafeInteger(prNumber) || prNumber <= 0) notFound();

  const repo = await repoFetchers.getRepoOrNotFound(owner, name);

  return <RepoPullDetailContainer name={name} owner={owner} prNumber={prNumber} repoId={repo.id} />;
}
