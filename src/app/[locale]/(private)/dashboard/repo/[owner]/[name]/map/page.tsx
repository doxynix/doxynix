import type { Metadata } from "next";

import type { ParamTypes } from "@/shared/types/app.types";

import { getRepoOrNotFound } from "@/entities/repo/model/get-repo";

import { RepoMapContainer } from "@/features/repo-map/ui/repo-map-container";

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

export default async function RepoMapPage({ params }: Readonly<Props>) {
  const { name, owner } = await params;

  const repo = await getRepoOrNotFound(owner, name);

  return <RepoMapContainer id={repo.id} />;
}
