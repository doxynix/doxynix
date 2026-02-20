import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RepoSetup } from "@/features/repo-setup";

import { api } from "@/server/trpc/server";

type Props = {
  params: Promise<{ owner: string; name: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { owner, name } = await params;

  return {
    title: `Setup analyze for ${owner}/${name}`,
  };
}

export default async function AnalyzePage({ params }: Props) {
  const { owner, name } = await params;

  const repo = await (
    await api()
  ).repo.getByName({
    owner,
    name,
  });

  if (repo == null) {
    notFound();
  }

  return (
    <>
      <RepoSetup repo={repo} />
    </>
  );
}
