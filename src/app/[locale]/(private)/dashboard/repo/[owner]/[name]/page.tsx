import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Status } from "@prisma/client";

import { RepoSetup } from "@/features/repo-setup";

import { api } from "@/server/trpc/server";

type Props = {
  params: Promise<{ name: string; owner: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name, owner } = await params;

  return {
    title: `${owner}/${name}`,
  };
}

export default async function RepoOwnerNamePage({ params }: Readonly<Props>) {
  const { name, owner } = await params;

  const repo = await (
    await api()
  ).repo.getByName({
    name,
    owner,
  });

  if (repo == null) {
    notFound();
  }

  return <>{repo.status === Status.NEW && <RepoSetup repo={repo} />}</>;
}
