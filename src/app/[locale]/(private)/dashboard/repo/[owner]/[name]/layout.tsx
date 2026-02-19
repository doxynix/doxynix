import { ReactNode } from "react";
import { Metadata } from "next";
import { notFound } from "next/navigation";

import { RepoDetailsHeader } from "@/features/repo-details";

import { api } from "@/server/trpc/server";

type Props = {
  params: Promise<{ owner: string; name: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
  children: ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { owner, name } = await params;

  return {
    title: `Setup analyze for ${owner}/${name}`,
  };
}

export default async function RepoDetailsLayout({ params, children }: Props) {
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
    <div className="mx-auto space-y-4">
      <div className="flex">
        <RepoDetailsHeader repo={repo} />
      </div>
      {children}
    </div>
  );
}
