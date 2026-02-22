import type { ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RepoDetailsHeader } from "@/features/repo-details";

import { api } from "@/server/trpc/server";

type Props = {
  children: ReactNode;
  params: Promise<{ name: string; owner: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
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
      <div className="flex">
        <RepoDetailsHeader repo={repo} />
      </div>
      {children}
    </div>
  );
}
