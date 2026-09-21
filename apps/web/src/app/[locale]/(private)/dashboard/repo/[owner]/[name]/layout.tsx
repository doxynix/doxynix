import type { RepoLayoutProps } from "@/shared/lib/next.types";

import { RepoDetailsHeader } from "@/features/repo/ui/repo-details-header";

import { repoFetchers } from "@/server/modules/repos/repo.fetchers";

export default async function RepoDetailsLayout({ children, params }: Readonly<RepoLayoutProps>) {
  const { name, owner } = await params;

  const repo = await repoFetchers.getRepoOrNotFound(owner, name);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        <RepoDetailsHeader repo={repo} />
      </div>
      {children}
    </div>
  );
}
