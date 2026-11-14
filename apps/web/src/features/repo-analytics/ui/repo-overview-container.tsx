"use client";
import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import { useTranslations } from "next-intl";

import { useTRPC } from "@/shared/api/trpc";
import { EmptyState } from "@/shared/ui/kit/empty-state";

import { useRepoParams } from "@/entities/repo/model/use-repo-params";
import { RepoAnalyzeButton } from "@/entities/repo/ui/repo-analyze-button";

import { RepoOverview } from "./repo-overview";
import { RepoOverviewSkeleton } from "./repo-overview-skeleton";

type Props = { repoId: string };

export function RepoOverviewContainer({ repoId }: Readonly<Props>) {
  const trpc = useTRPC();
  const t = useTranslations("Dashboard");
  const { aid, name, owner } = useRepoParams();
  const { data, isLoading } = useQuery(
    trpc.analysis.getWorkspace.queryOptions({
      aid: aid ?? undefined,
      repoId,
    }),
  );

  if (isLoading) {
    return <RepoOverviewSkeleton />;
  }

  if (data == null) {
    return (
      <div className="flex h-150 items-center justify-center rounded-xl border border-dashed">
        <EmptyState
          action={
            <RepoAnalyzeButton
              name={name}
              owner={owner}
            />
          }
          description={t("repo_overview_empty_desc")}
          icon={BarChart3}
          title={t("repo_overview_empty_title")}
        />
      </div>
    );
  }

  return <RepoOverview data={data} />;
}
