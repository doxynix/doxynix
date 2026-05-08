import type { Metadata } from "next";

import type { ParamTypes } from "@/shared/types/app.types";

import { RepoHistoryContainer } from "@/features/repo-analytics/ui/repo-history-container";

import { getRepoOrNotFound } from "@/server/entities/repo/api/get-repo";

type Props = {
  params: Promise<{ name: string; owner: string }>;
  searchParams: Promise<{ [key: string]: ParamTypes }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name, owner } = await params;

  return {
    title: `${owner}/${name}`,
  };
}

export default async function RepoHistoryPage({ params }: Readonly<Props>) {
  const { name, owner } = await params;

  const repo = await getRepoOrNotFound(owner, name);

  return (
    <div className="space-y-10">
      <RepoHistoryContainer id={repo.id} />
    </div>
  );
}
