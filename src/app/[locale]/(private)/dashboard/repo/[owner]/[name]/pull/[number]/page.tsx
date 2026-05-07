import { notFound } from "next/navigation";

import { getRepoOrNotFound } from "@/entities/repo/model/get-repo";

import { RepoPullDetailContainer } from "@/features/repo-pulls/ui/repo-pull-details-container";

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

  const repo = await getRepoOrNotFound(owner, name);

  return <RepoPullDetailContainer name={name} owner={owner} prNumber={prNumber} repoId={repo.id} />;
}
