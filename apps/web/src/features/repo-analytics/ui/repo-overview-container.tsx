"use client";

import { BarChart3 } from "lucide-react";
import { useTranslations } from "next-intl";

import { trpc } from "@/shared/api/trpc";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { EmptyState } from "@/shared/ui/kit/empty-state";

import { useRepoParams } from "@/entities/repo/model/use-repo-params";
import { RepoAnalyzeButton } from "@/entities/repo/ui/repo-analyze-button";

import { RepoOverview } from "./repo-overview";

type Props = { repoId: string };

export function RepoOverviewContainer({ repoId }: Readonly<Props>) {
  const t = useTranslations("Dashboard");
  const { aid, name, owner } = useRepoParams();
  const { data, isLoading } = trpc.analysis.getWorkspace.useQuery({
    aid: aid ?? undefined,
    repoId,
  });

  if (isLoading) {
    return <Skeleton className="mb-4 ml-auto h-150 w-full text-sm" />;
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
