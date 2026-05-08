import type { ReactNode } from "react";
import type { Metadata } from "next";

import type { ParamTypes } from "@/shared/types/app.types";

import { getRepoOrNotFound } from "@/entities/repo/model/get-repo";

import { RepoDetailsHeader } from "@/features/repo/ui/repo-details-header";

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

  const repo = await getRepoOrNotFound(owner, name);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4">
        <RepoDetailsHeader repo={repo} />
      </div>
      {children}
    </div>
  );
}
