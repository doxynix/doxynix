import type { Metadata } from "next";

import type { RepoLayoutProps } from "@/shared/types/next.types";

import { RepoDetailsHeader } from "@/features/repo/ui/repo-details-header";

import { repoFetchers } from "@/server/modules/repos/repo.fetchers";

export async function generateMetadata({
  params,
}: Omit<RepoLayoutProps, "children">): Promise<Metadata> {
  const { name, owner } = await params;

  return {
    title: `Setup analyze for ${owner}/${name}`,
  };
}

export default async function RepoDetailsLayout({ children, params }: Readonly<RepoLayoutProps>) {
  const { name, owner } = await params;

  const repo = await repoFetchers.getRepoOrNotFound(owner, name);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4">
        <RepoDetailsHeader repo={repo} />
      </div>
      {children}
    </div>
  );
}
