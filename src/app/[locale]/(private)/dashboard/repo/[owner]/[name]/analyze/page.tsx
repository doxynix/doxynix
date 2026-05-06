import type { Metadata } from "next";

import type { ParamTypes } from "@/shared/types/app.types";

import { getRepoOrNotFound } from "@/entities/repo/model/get-repo";

import { RepoSetup } from "@/features/repo-setup/ui/repo-setup";

type Props = {
  params: Promise<{ name: string; owner: string }>;
  searchParams: Promise<{ [key: string]: ParamTypes }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name, owner } = await params;

  return {
    title: `Setup analyze for ${owner}/${name}`,
  };
}

export default async function AnalyzePage({ params }: Readonly<Props>) {
  const { name, owner } = await params;

  const repo = await getRepoOrNotFound(owner, name);

  return <RepoSetup repo={repo} />;
}
