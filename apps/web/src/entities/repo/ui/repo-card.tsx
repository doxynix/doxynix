"use client";

import { Settings } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/cn";
import { formatFullDate } from "@/shared/lib/date-utils";
import { AnimatedCircularProgressBar } from "@/shared/ui/core/animated-circular-progress-bar";
import { AppBadge } from "@/shared/ui/core/badge";
import { Card, CardContent } from "@/shared/ui/core/card";
import { GitHubIcon } from "@/shared/ui/icons/github-icon";
import { AppAvatar } from "@/shared/ui/kit/app-avatar";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";
import { ExternalLink } from "@/shared/ui/kit/external-link";
import { TimeAgo } from "@/shared/ui/kit/time-ago";

import { getHealthColor } from "../model/get-health-color";
import { getGitMetrics } from "../model/git-metrics";
import { getMetrics } from "../model/metrics";
import type { UiRepoListItem } from "../model/repo.types";
import { repoStatusConfig } from "../model/repo-status-config";
import { repoVisibilityConfig } from "../model/repo-visibility";
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
    <Card className="group relative flex overflow-hidden p-4 transition-colors hover:border-border-strong">
      <CardContent className="flex justify-center gap-4 md:justify-between">
        <div className="flex min-w-0 flex-wrap not-md:justify-center gap-2 sm:flex-nowrap">
          <AppAvatar
            alt={repo.owner}
            fallbackText={repo.owner}
            sizeClassName="size-9"
            src={repo.ownerAvatarUrl}
          />

          <div className="flex min-w-0 flex-col not-md:items-center justify-between gap-1">
            <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center justify-center gap-1 truncate text-sm">
                <div>
                  <Link
                    className="truncate font-bold text-muted-foreground hover:underline"
                    href={`/dashboard/repo/${repo.owner}`}
                  >
                    {repo.owner}
                  </Link>
                  <span className="text-muted-foreground">/</span>
                  <Link
                    className="truncate font-bold hover:underline"
                    href={`/dashboard/repo/${repo.owner}/${repo.name}`}
                  >
                    {repo.name}
                  </Link>
                </div>
                <AppBadge className={cn(visibility.color)} variant="outline">
                  {visibility.label}
                </AppBadge>
                <div className={cn("flex shrink-0 items-center gap-1 transition-standard")}>
                  <AppTooltip content={t("repo_open_on_github_tooltip")}>
                    <ExternalLink
                      aria-label={t("repo_open_on_github_tooltip")}
                      className="flex size-6 items-center justify-center rounded text-muted-foreground not-md:opacity-100 opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                      href={repo.url}
                    >
                      <GitHubIcon className="size-4" />
                    </ExternalLink>
                  </AppTooltip>
                  <AppTooltip content="Open settings">
                    <Link
                      aria-label={`Settings for ${repo.name}`}
                      className="flex size-6 items-center justify-center text-muted-foreground not-md:opacity-100 opacity-0 transition-standard hover:text-foreground group-hover:opacity-100"
                      href={`/dashboard/repo/${repo.owner}/${repo.name}/settings`}
                    >
                      <Settings />
                    </Link>
                  </AppTooltip>
                </div>
              </div>
            </div>

            <p className="wrap-break-word line-clamp-2 not-sm:text-center text-muted-foreground text-sm">
              {repo.description ?? t("repo_empty_desc")}
            </p>

            <RepoTopics repoTopics={repo.topics} />

            <div className="mt-1 flex flex-wrap items-center not-md:justify-center gap-3">
              {gitMetrics.map((m) => (
                <RepoGitMetric
                  className={cn(
                    "text-muted-foreground text-xs transition-colors hover:text-foreground",
                    m.className,
                  )}
                  color={m.color}
                  icon={m.icon}
                  key={m.id}
                  label={m.label}
                  tooltip={m.tooltip}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between not-sm:gap-2 text-xs sm:flex-col md:items-end">
          {hasAnalysis ? (
            <div className="flex flex-wrap items-center gap-4">
              {analysisMetrics.map((m) => (
                <AnimatedCircularProgressBar
                  className={cn(
                    "size-8 text-[10px] text-muted-foreground transition-colors hover:text-foreground",
                  )}
                  gaugePrimaryColor={getHealthColor(m.score ?? 0)}
                  gaugeSecondaryColor="var(--muted)"
                  key={m.id}
                  value={m.score ?? 0}
                />
              ))}
            </div>
          ) : (
            <span className="my-2 text-right text-muted-foreground text-xs">Not analyzed yet</span>
          )}
          <div className="flex flex-col items-end gap-1">
            <AppBadge className={cn(status.color)} variant="outline">
              {status.label}
            </AppBadge>
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
