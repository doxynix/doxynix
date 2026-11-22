"use client";

import { Fragment } from "react";
import { Settings } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/cn";
import { AppBadge } from "@/shared/ui/core/badge";
import { AppButton } from "@/shared/ui/core/button";
import { Card } from "@/shared/ui/core/card";
import { GitHubIcon } from "@/shared/ui/icons/github-icon";
import { AppAvatar } from "@/shared/ui/kit/app-avatar";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";
import { ExternalLink } from "@/shared/ui/kit/external-link";
import { StatusBadge } from "@/shared/ui/kit/status-badge";
import { TimeAgo } from "@/shared/ui/kit/time-ago";

import { getHealthColor } from "../model/get-health-color";
import { getGitMetrics } from "../model/git-metrics";
import type { UiRepoListItem } from "../model/repo.types";
import { repoStatusConfig } from "../model/repo-status-config";
import { repoVisibilityConfig } from "../model/repo-visibility-config";
import { RepoAnalyzeButton } from "./repo-analyze-button";
import { RepoGitMetric } from "./repo-git-metric";
import { RepoTopics } from "./repo-topics";

type Props = {
  repo: UiRepoListItem;
  variant?: "row" | "brief";
};

const ACTION_OPACITY =
  "not-md:opacity-100 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100";

function RepoNameLinks({
  href,
  name,
  owner,
}: Readonly<{ href: string; name: string; owner: string }>) {
  return (
    <div className="flex min-w-0 items-center gap-1 text-sm">
      <Link
        className="truncate font-semibold text-muted-foreground hover:underline"
        href={`/dashboard/repo/${owner}`}
      >
        {owner}
      </Link>
      <span className="text-muted-foreground">/</span>
      <Link
        className="truncate font-semibold hover:underline"
        href={href}
      >
        {name}
      </Link>
    </div>
  );
}

function RepoQuickActions({ repo }: Readonly<{ repo: UiRepoListItem }>) {
  const t = useTranslations("Dashboard");

  return (
    <div className={cn("flex shrink-0 items-center gap-0.5", ACTION_OPACITY)}>
      <AppTooltip content={t("repo_open_on_github_tooltip")}>
        <ExternalLink
          aria-label={t("repo_open_on_github_tooltip")}
          className="flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground focus-visible:opacity-100"
          href={repo.url}
        >
          <GitHubIcon className="size-4" />
        </ExternalLink>
      </AppTooltip>
      <AppTooltip content={t("repo_open_settings")}>
        <Link
          aria-label={t("repo_settings_for", { name: repo.name })}
          className="flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground focus-visible:opacity-100"
          href={`/dashboard/repo/${repo.owner}/${repo.name}/settings`}
        >
          <Settings className="" />
        </Link>
      </AppTooltip>
    </div>
  );
}

function RepoReportButton({ href }: Readonly<{ href: string }>) {
  const t = useTranslations("Dashboard");

  return (
    <AppButton
      asChild
      size="sm"
      variant="outline"
    >
      <Link href={href}>{t("repo_analysis_view_results")}</Link>
    </AppButton>
  );
}

function RepoRowCard({ repo }: Readonly<{ repo: UiRepoListItem }>) {
  const t = useTranslations("Dashboard");
  const locale = useLocale();
  const visibility = repoVisibilityConfig[repo.visibility];
  const status = repoStatusConfig[repo.status];
  const gitMetrics = getGitMetrics(repo, locale).filter((m) => m.label !== "");

  const hasAnalysis = repo.healthScore != null;
  const repoHref = `/dashboard/repo/${repo.owner}/${repo.name}`;

  return (
    <Card
      className="group"
      size="row"
    >
      <AppAvatar
        alt={repo.owner}
        fallbackText={repo.owner}
        sizeClassName="size-9"
        src={repo.ownerAvatarUrl}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <RepoNameLinks
            href={repoHref}
            name={repo.name}
            owner={repo.owner}
          />
          <AppBadge
            className={cn(visibility.color)}
            variant="outline"
          >
            {t(visibility.labelKey)}
          </AppBadge>
        </div>

        <p className="line-clamp-2 min-w-0 text-muted-foreground text-sm">
          {repo.description ?? t("repo_empty_desc")}
        </p>

        <RepoTopics repoTopics={repo.topics} />

        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-muted-foreground">
          {gitMetrics.map((m, index) => (
            <Fragment key={m.id}>
              {index > 0 && (
                <span
                  aria-hidden="true"
                  className="text-border-strong"
                >
                  ·
                </span>
              )}
              <RepoGitMetric
                className="transition-colors hover:text-foreground"
                color={m.color}
                icon={m.icon}
                label={m.label}
                tooltip={t(m.tooltipKey)}
              />
            </Fragment>
          ))}
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
        <div className="flex items-center gap-1.5">
          <StatusBadge
            size="sm"
            tone={status.tone}
          >
            {t(status.labelKey)}
          </StatusBadge>
          {repo.lastAnalysisDate != null && (
            <TimeAgo
              className="text-2xs"
              date={repo.lastAnalysisDate}
              locale={locale}
            />
          )}
        </div>

        {hasAnalysis ? (
          <RepoReportButton href={repoHref} />
        ) : (
          <RepoAnalyzeButton
            name={repo.name}
            owner={repo.owner}
          />
        )}

        <RepoQuickActions repo={repo} />
      </div>
    </Card>
  );
}

function RepoBriefCard({ repo }: Readonly<{ repo: UiRepoListItem }>) {
  const t = useTranslations("Dashboard");
  const locale = useLocale();
  const visibility = repoVisibilityConfig[repo.visibility];
  const status = repoStatusConfig[repo.status];

  const hasAnalysis = repo.healthScore != null;
  const healthScore = repo.healthScore ?? 0;
  const securityScore = repo.securityScore ?? 0;
  const repoHref = `/dashboard/repo/${repo.owner}/${repo.name}`;

  const metaItems = [
    repo.language != null
      ? { id: "language", node: <span className="truncate">{repo.language}</span> }
      : null,
    { id: "branch", node: <span className="truncate">{repo.defaultBranch}</span> },
    repo.pushedAt != null
      ? {
          id: "pushed",
          node: (
            <TimeAgo
              className="text-2xs"
              date={repo.pushedAt}
              locale={locale}
            />
          ),
        }
      : null,
  ].filter((item) => item != null);

  return (
    <Card className="group gap-4">
      <div className="flex min-w-0 items-start gap-3 px-6">
        <AppAvatar
          alt={repo.owner}
          fallbackText={repo.owner}
          sizeClassName="size-9"
          src={repo.ownerAvatarUrl}
        />

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <RepoNameLinks
              href={repoHref}
              name={repo.name}
              owner={repo.owner}
            />
            <AppBadge
              className={cn(visibility.color)}
              variant="outline"
            >
              {t(visibility.labelKey)}
            </AppBadge>
          </div>

          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 text-2xs text-muted-foreground">
            {metaItems.map((item, index) => (
              <Fragment key={item.id}>
                {index > 0 && (
                  <span
                    aria-hidden="true"
                    className="text-border-strong"
                  >
                    ·
                  </span>
                )}
                {item.node}
              </Fragment>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <StatusBadge
            size="sm"
            tone={status.tone}
          >
            {t(status.labelKey)}
          </StatusBadge>
          <RepoQuickActions repo={repo} />
        </div>
      </div>

      <div className="px-6">
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <div className="text-2xs text-muted-foreground">{t("quality_health")}</div>
            <div className="mt-0.5 font-semibold text-xl tabular-nums">
              {repo.healthScore ?? <span className="text-muted-foreground">—</span>}
              <span className="font-normal text-muted-foreground text-xs">/100</span>
            </div>
            {repo.healthScore != null && (
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{
                    backgroundColor: getHealthColor(healthScore),
                    width: `${Math.min(Math.max(healthScore, 0), 100)}%`,
                  }}
                />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-2xs text-muted-foreground">{t("quality_security")}</div>
            <div className="mt-0.5 font-semibold text-xl tabular-nums">
              {repo.securityScore ?? <span className="text-muted-foreground">—</span>}
              <span className="font-normal text-muted-foreground text-xs">/100</span>
            </div>
            {repo.securityScore != null && (
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{
                    backgroundColor: getHealthColor(securityScore),
                    width: `${Math.min(Math.max(securityScore, 0), 100)}%`,
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t px-6 pt-4">
        {hasAnalysis ? (
          <RepoReportButton href={repoHref} />
        ) : (
          <AppButton
            asChild
            size="sm"
            variant="outline"
          >
            <Link href={`/dashboard/repo/${repo.owner}/${repo.name}/analyze`}>
              {t("repo_analyze_run")}
            </Link>
          </AppButton>
        )}
      </div>
    </Card>
  );
}

export function RepoCard({ repo, variant = "row" }: Readonly<Props>) {
  if (variant === "brief") {
    return <RepoBriefCard repo={repo} />;
  }

  return <RepoRowCard repo={repo} />;
}
