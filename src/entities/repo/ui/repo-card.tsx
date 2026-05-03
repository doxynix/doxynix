"use client";

import { Settings } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { cn } from "@/shared/lib/cn";
import { formatFullDate } from "@/shared/lib/date-utils";
import { AnimatedCircularProgressBar } from "@/shared/ui/core/animated-circular-progress-bar";
import { Badge } from "@/shared/ui/core/badge";
import { Card, CardContent } from "@/shared/ui/core/card";
import { GitHubIcon } from "@/shared/ui/icons/github-icon";
import { AppAvatar } from "@/shared/ui/kit/app-avatar";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";
import { ExternalLink } from "@/shared/ui/kit/external-link";
import { TimeAgo } from "@/shared/ui/kit/time-ago";
import { Link } from "@/i18n/routing";

import { getHealthColor } from "../model/get-health-color";
import { getGitMetrics } from "../model/git-metrics";
import { getMetrics } from "../model/metrics";
import { repoStatusConfig } from "../model/repo-status-config";
import { repoVisibilityConfig } from "../model/repo-visibility";
import type { UiRepoListItem } from "../model/repo.types";
import { RepoAnalyzeButton } from "./repo-analyze-button";
import { RepoGitMetric } from "./repo-git-metric";
import { RepoTopics } from "./repo-topics";

type Props = {
  repo: UiRepoListItem;
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
    <Card className="group hover:border-border-strong relative flex overflow-hidden p-4 transition-colors">
      <CardContent className="flex justify-center gap-4 md:justify-between">
        <div className="flex min-w-0 flex-wrap gap-2 not-md:justify-center sm:flex-nowrap">
          <AppAvatar
            alt={repo.owner}
            fallbackText={repo.owner}
            sizeClassName="size-9"
            src={repo.ownerAvatarUrl}
          />

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
                  <AppTooltip content={t("repo_open_on_github_tooltip")}>
                    <ExternalLink
                      href={repo.url}
                      aria-label={t("repo_open_on_github_tooltip")}
                      className="text-muted-foreground hover:text-foreground flex size-6 items-center justify-center rounded opacity-0 transition-opacity not-md:opacity-100 group-hover:opacity-100"
                    >
                      <GitHubIcon className="size-4" />
                    </ExternalLink>
                  </AppTooltip>
                  <AppTooltip content="Open settings">
                    <Link
                      href={`/dashboard/repo/${repo.owner}/${repo.name}/settings`}
                      aria-label={`Settings for ${repo.name}`}
                      className="text-muted-foreground hover:text-foreground flex size-6 items-center justify-center opacity-0 transition-all not-md:opacity-100 group-hover:opacity-100"
                    >
                      <Settings />
                    </Link>
                  </AppTooltip>
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
            <Badge variant="outline" className={cn(status.color)}>
              {status.label}
            </Badge>
            {repo.lastAnalysisDate != null && (
              <AppTooltip
                content={t("repo_last_analyzed", {
                  dateTime: formatFullDate(repo.lastAnalysisDate, locale),
                })}
              >
                <TimeAgo date={repo.lastAnalysisDate} locale={locale} />
              </AppTooltip>
            )}
            {!hasAnalysis && <RepoAnalyzeButton name={repo.name} owner={repo.owner} />}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
