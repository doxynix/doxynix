import { notFound } from "next/navigation";

import { RepoPullDetailContainer } from "@/features/repo-pulls/ui/repo-pull-details-container";

import { api } from "@/server/api/server";

type Props = {
  params: Promise<{ name: string; number: string; owner: string }>;
};

export default async function PullRequestDetailPage({ params }: Readonly<Props>) {
  const { name, number, owner } = await params;
  const prNumber = parseInt(number);

  const serverApi = await api();
  const repo = await serverApi.repo.getByName({ name, owner });

  if (repo == null || isNaN(prNumber)) notFound();

  return <RepoPullDetailContainer prNumber={prNumber} repoId={repo.id} />;
}
