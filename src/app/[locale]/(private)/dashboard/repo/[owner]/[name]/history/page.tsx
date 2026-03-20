import type { Metadata } from "next";
import { notFound } from "next/navigation";

import type { ParamTypes } from "@/shared/types/app";

import { RepoHistoryContainer } from "@/features/repo-analytics";

import { api } from "@/server/trpc/server";

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

  const repo = await (
    await api()
  ).repo.getByName({
    name,
    owner,
  });

  if (repo == null || repo.status === "NEW") {
    notFound();
  }

  return (
    <div className="space-y-10">
      <RepoHistoryContainer id={repo.id} />
    </div>
  );
}
