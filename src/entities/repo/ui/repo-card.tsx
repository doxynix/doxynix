"use client";

import { Play, Settings } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import type { UiRepoListItem } from "@/shared/api/trpc";
import { cn, formatFullDate, formatRelativeTime } from "@/shared/lib/utils";
import { AnimatedCircularProgressBar } from "@/shared/ui/core/animated-circular-progress-bar";
import { Badge } from "@/shared/ui/core/badge";
import { Button } from "@/shared/ui/core/button";
import { Card, CardContent } from "@/shared/ui/core/card";
import { GitHubIcon } from "@/shared/ui/icons/github-icon";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";
import { CopyButton } from "@/shared/ui/kit/copy-button";
import { Link } from "@/i18n/routing";

import { getGitMetrics } from "../model/git-metrics";
import { getMetrics } from "../model/metrics";
import { repoStatusConfig } from "../model/repo-status";
import { repoVisibilityConfig } from "../model/repo-visibility";
import { RepoAvatar } from "./repo-avatar";
import { RepoGitMetric } from "./repo-git-metric";
import { RepoTopics } from "./repo-topics";

type Props = {
  repo: UiRepoListItem;
};

const getHealthColor = (score: number) => {
  if (score < 50) return "var(--color-destructive)";
  if (score < 80) return "var(--color-warning)";
  return "var(--color-success)";
};

export function RepoCard({ repo }: Readonly<Props>) {
  const t = useTranslations("Dashboard");
  const locale = useLocale();
  const visibility = repoVisibilityConfig[repo.visibility];
  const status = repoStatusConfig[repo.status];
  const gitMetrics = getGitMetrics(repo, locale);
  const analysisMetrics = getMetrics(repo);

  const hasAnalysis = repo.healthScore != null;

  return (
    <Card className="group hover:bg-muted/50 relative flex overflow-hidden p-4 transition-colors">
      <CardContent className="flex justify-center gap-4 md:justify-between">
        <div className="flex min-w-0 flex-wrap gap-2 not-md:justify-center sm:flex-nowrap">
          <RepoAvatar alt={repo.owner} src={repo.ownerAvatarUrl ?? "/avatar-placeholder.png"} />
          <div className="flex min-w-0 flex-col justify-between gap-1 not-md:items-center">
            <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center justify-center gap-1 truncate text-sm">
                <div>
                  <Link
                    href={`/dashboard/repo/${repo.owner}`}
                    className="text-muted-foreground truncate font-bold hover:underline"
                  >
                    {repo.owner}
                  </Link>
                  <span className="text-muted-foreground">/</span>
                  <Link
                    href={`/dashboard/repo/${repo.owner}/${repo.name}`}
                    className="truncate font-bold hover:underline"
                  >
                    {repo.name}
                  </Link>
                </div>
                <Badge variant="outline" className={cn(visibility.color)}>
                  {visibility.label}
                </Badge>
                <div
                  className={cn("flex shrink-0 items-center gap-1 transition-opacity duration-200")}
                >
                  <CopyButton value={repo.id} />
                  <AppTooltip content={t("repo_open_on_github_tooltip")}>
                    <a
                      href={repo.url}
                      rel="noopener noreferrer"
                      target="_blank"
                      className="text-muted-foreground hover:text-foreground flex h-6 w-6 items-center justify-center rounded opacity-0 transition-opacity not-md:opacity-100 group-hover:opacity-100"
                    >
                      <GitHubIcon className="h-4 w-4" />
                    </a>
                  </AppTooltip>
                  <Link
                    href={`/dashboard/repo/${repo.owner}/${repo.name}/settings`}
                    className="text-muted-foreground hover:text-foreground flex h-6 w-6 items-center justify-center opacity-0 transition-all not-md:opacity-100 group-hover:opacity-100"
                  >
                    <Settings className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>

            <p className="text-muted-foreground line-clamp-2 text-sm wrap-break-word not-sm:text-center">
              {repo.description ?? t("repo_empty_desc")}
            </p>

            <RepoTopics repoTopics={repo.topics} />

            <div className="mt-1 flex flex-wrap items-center gap-3 not-md:justify-center">
              {gitMetrics.map((m) => (
                <RepoGitMetric
                  key={m.id}
                  color={m.color}
                  icon={m.icon}
                  label={m.label}
                  tooltip={m.tooltip}
                  className={cn(
                    "text-muted-foreground hover:text-foreground text-xs transition-colors",
                    m.className
                  )}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs not-sm:gap-2 sm:flex-col md:items-end">
          {hasAnalysis ? (
            <div className="flex flex-wrap items-center gap-4">
              {analysisMetrics.map((m) => (
                <AnimatedCircularProgressBar
                  key={m.id}
                  value={m.score ?? 0}
                  gaugePrimaryColor={getHealthColor(m.score ?? 0)}
                  gaugeSecondaryColor="var(--muted)"
                  className={cn(
                    "text-muted-foreground hover:text-foreground size-8 text-[10px] transition-colors"
                  )}
                />
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground my-2 text-right text-xs">Not analyzed yet</span>
          )}
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1 rounded">
              <span className={cn("h-2 w-2 rounded-full", status.color)} />
              <span className="font-medium">{status.label}</span>
            </div>
            {repo.lastAnalysisDate != null && (
              <AppTooltip
                content={t("repo_last_analyzed", {
                  dateTime: formatFullDate(repo.lastAnalysisDate, locale),
                })}
              >
                <span className="text-muted-foreground hover:text-foreground cursor-help transition-colors">
                  {formatRelativeTime(repo.lastAnalysisDate, locale)}
                </span>
              </AppTooltip>
            )}
            {!hasAnalysis && (
              <Button asChild size="sm" variant="outline" className="mt-2 cursor-pointer">
                <Link href={`/dashboard/repo/${repo.owner}/${repo.name}/analyze`}>
                  <Play className="h-4 w-4" />
                  Run Analysis
                </Link>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
