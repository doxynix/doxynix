import type { Metadata } from "next";

import type { ParamTypes } from "@/shared/types/app.types";

import { RepoAnalysisLive } from "@/features/repo-setup/ui/repo-analysis-live";
import { RepoSetup } from "@/features/repo-setup/ui/repo-setup";

import { api } from "@/server/api/server";
import { getRepoOrNotFound } from "@/server/entities/repo/api/get-repo";

type Props = {
  params: Promise<{ name: string; owner: string }>;
  searchParams: Promise<{ [key: string]: ParamTypes }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name, owner } = await params;

  return {
    title: `Setup analyze for ${owner}/${name}`,
  };
}

export default async function AnalyzePage({ params }: Readonly<Props>) {
  const { name, owner } = await params;

  const repo = await getRepoOrNotFound(owner, name);

  const serverApi = await api();
  const lastAnalysis = await serverApi.repoAnalysis.getLatest({ repoId: repo.id });

  const isRunning =
    lastAnalysis != null &&
    lastAnalysis.status === "PENDING" &&
    lastAnalysis.jobId !== null &&
    lastAnalysis.publicAccessToken != null;

  return (
    <div className="mx-auto px-4 py-6">
      {isRunning ? (
        <RepoAnalysisLive
          accessToken={lastAnalysis.publicAccessToken!}
          jobId={lastAnalysis.jobId!}
          repoId={repo.id}
        />
      ) : (
        <RepoSetup repo={repo} />
      )}
    </div>
  );
}
