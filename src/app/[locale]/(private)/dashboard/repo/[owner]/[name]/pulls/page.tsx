import type { Metadata } from "next";

import type { ParamTypes } from "@/shared/types/app.types";

import { getRepoOrNotFound } from "@/entities/repo/model/get-repo";

import { RepoPullsListContainer } from "@/features/repo-pulls/ui/repo-pulls-list-container";

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

export default async function RepoPullsPage({ params }: Readonly<Props>) {
  const { name, owner } = await params;

  const repo = await getRepoOrNotFound(owner, name);

  return <RepoPullsListContainer name={name} owner={owner} repoId={repo.id} />;
}
