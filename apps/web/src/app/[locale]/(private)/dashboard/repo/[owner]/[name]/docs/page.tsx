import { createRepoMetadata } from "@/shared/lib/metadata";
import type { RepoPageProps } from "@/shared/lib/next.types";

import { RepoDocsContainer } from "@/features/repo-docs-viewer/ui/repo-docs-container";

import { repoFetchers } from "@/server/modules/repos/repo.fetchers";

export const generateMetadata = createRepoMetadata("docs");

export default async function RepoDocsPage({ params }: Readonly<RepoPageProps>) {
  const { name, owner } = await params;

  const repo = await repoFetchers.getRepoOrNotFound(owner, name);

  return (
    <div className="flex flex-col gap-10">
      <RepoDocsContainer id={repo.id} />
    </div>
  );
}
