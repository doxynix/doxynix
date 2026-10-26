"use client";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { useTRPC } from "@/shared/api/trpc";
import { cn } from "@/shared/lib/cn";
import { Card } from "@/shared/ui/core/card";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { GitHubIcon } from "@/shared/ui/icons/github-icon";
import { SkeletonList, SkeletonText } from "@/shared/ui/kit/app-skeleton";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";
import { CopyButton } from "@/shared/ui/kit/copy-button";
import { ExternalLink } from "@/shared/ui/kit/external-link";

import { RepoPullDetailsContent } from "./repo-pull-details-content";

type Props = {
  name: string;
  owner: string;
  prNumber: number;
  repoId: string;
};

export function RepoPullDetailContainer({ name, owner, prNumber, repoId }: Readonly<Props>) {
  const trpc = useTRPC();
  const t = useTranslations("Dashboard");
  const { data: analysis, isLoading: isAnalysisLoading } = useQuery(
    trpc.analysis.getByPRNumber.queryOptions({
      prNumber,
      repoId,
    }),
  );

  if (isAnalysisLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between border-b pb-6">
          <div className="flex flex-col gap-2">
            <SkeletonText
              lines={1}
              size="xxl"
              widths={["w-56"]}
            />
            <div className="flex items-center gap-1">
              <SkeletonText
                lines={1}
                size="lg"
                widths={["w-24"]}
              />
              <Skeleton className="size-6 rounded-md" />
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <SkeletonText
              lines={1}
              widths={["w-24"]}
            />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <SkeletonList
            className="flex flex-col gap-6 lg:col-span-2"
            count={4}
            renderItem={() => (
              <Card>
                <div className="px-6">
                  <SkeletonText
                    lines={1}
                    size="xl"
                    widths={["w-48"]}
                  />
                </div>
                <div className="flex flex-col gap-3 px-6">
                  <Skeleton className="h-24 w-full rounded-xl" />
                  <Skeleton className="h-24 w-full rounded-xl" />
                </div>
              </Card>
            )}
          />
          <SkeletonList
            className="flex flex-col gap-6"
            count={3}
            renderItem={() => (
              <Card>
                <div className="px-6">
                  <SkeletonText
                    lines={1}
                    size="xl"
                    widths={["w-40"]}
                  />
                </div>
                <div className="flex flex-col gap-3 px-6">
                  <Skeleton className="h-16 w-full rounded-lg" />
                  <Skeleton className="h-16 w-full rounded-lg" />
                </div>
              </Card>
            )}
          />
        </div>
      </div>
    );
  }

  if (analysis == null) {
    return <div>{t("repo_pull_not_found")}</div>;
  }

  const riskScore = analysis.analysis.riskScore;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-2xl">
              {t("repo_pull_title_prefix")}#{analysis.analysis.prNumber}
            </h1>
            <AppTooltip content={t("repo_open_on_github_tooltip")}>
              <ExternalLink
                aria-label={t("repo_open_on_github_tooltip")}
                className="flex size-6 items-center justify-center text-muted-foreground hover:text-foreground"
                href={`https://github.com/${owner}/${name}/pull/${prNumber}`}
              >
                <GitHubIcon className="size-4" />
              </ExternalLink>
            </AppTooltip>
          </div>
          <div className="flex items-center gap-1">
            <p className="text-muted-foreground text-sm">{analysis.analysis.headSha.slice(0, 7)}</p>
            <CopyButton
              className="opacity-100"
              tooltipText={t("repo_pull_copy_sha")}
              value={analysis.analysis.headSha}
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          {riskScore != null && (
            <div className="text-right">
              <p className="text-muted-foreground text-xs">{t("repo_pull_risk_score")}</p>
              <p
                className={cn(
                  "font-black text-3xl",
                  riskScore > 7
                    ? "text-destructive"
                    : riskScore > 4
                      ? "text-warning"
                      : "text-success",
                )}
              >
                {riskScore}
                /10
              </p>
            </div>
          )}
        </div>
      </div>
      <RepoPullDetailsContent
        analysis={analysis}
        impact={analysis}
        name={name}
        owner={owner}
        repoId={repoId}
      />
    </div>
  );
}
