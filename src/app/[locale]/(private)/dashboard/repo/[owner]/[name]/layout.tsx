import type { ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import type { ParamTypes } from "@/shared/types/app";

import { RepoDetailsTabs } from "@/entities/repo-details";

import { RepoDetailsHeader } from "@/features/repo";

import { api } from "@/server/trpc/server";

type Props = {
  children: ReactNode;
  params: Promise<{ name: string; owner: string }>;
  searchParams: Promise<{ [key: string]: ParamTypes }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name, owner } = await params;

  return {
    title: `Setup analyze for ${owner}/${name}`,
  };
}

export default async function RepoDetailsLayout({ children, params }: Readonly<Props>) {
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

  return (
    <div className="mx-auto space-y-4">
      <div className="flex flex-col gap-4">
        <RepoDetailsHeader repo={repo} />
        <RepoDetailsTabs name={repo.name} owner={repo.owner} status={repo.status} />
      </div>
      {children}
    </div>
  );
}
