import { getLocale, getTranslations } from "next-intl/server";

import { cn, formatFullDate, formatRelativeTime } from "@/shared/lib/utils";
import { Card, CardContent } from "@/shared/ui/core/card";
import { GitHubIcon } from "@/shared/ui/icons/github-icon";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";
import { CopyButton } from "@/shared/ui/kit/copy-button";

import { Link } from "@/i18n/routing";
import { getLanguageColor } from "../model/language-colors";
import { getMetrics } from "../model/metrics";
import { repoStatusConfig } from "../model/repo-status";
import { repoVisibilityConfig } from "../model/repo-visibility";
import { RepoTableItem } from "../model/types";
import { RepoAvatar } from "./repo-avatar";
import { RepoMetric } from "./repo-metric";

type Props = {
  repo: RepoTableItem;
};

export async function RepoCard({ repo }: Props) {
  const t = await getTranslations("Dashboard");
  const locale = await getLocale();
  const visibility = repoVisibilityConfig[repo.visibility];
  const status = repoStatusConfig[repo.status];
  const metrics = getMetrics(repo);
  const langColor = getLanguageColor(repo.language);

  return (
    <Card className="group relative flex overflow-hidden p-4">
      <CardContent className="flex flex-wrap items-end justify-center gap-4 md:justify-between">
        <div className="flex min-w-0 flex-wrap gap-2 not-md:justify-center sm:flex-nowrap">
          <RepoAvatar src={repo.ownerAvatarUrl ?? "/avatar-placeholder.png"} alt={repo.owner} />
          <div className="flex min-w-0 flex-col justify-between gap-1 not-md:items-center">
            <div className="flex w-full min-w-0 flex-wrap items-center gap-2 not-sm:justify-center">
              <div className="flex flex-wrap items-center justify-center gap-0.5 truncate text-sm">
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
              {visibility !== null && (
                <AppTooltip content={cn(visibility.label)}>
                  <div className="flex shrink-0 items-center gap-1.5 text-xs">
                    <visibility.icon className={cn("h-3.5 w-3.5", visibility.color)} />
                  </div>
                </AppTooltip>
              )}
              <div
                className={cn("flex shrink-0 items-center gap-1 transition-opacity duration-200")}
              >
                <CopyButton value={repo.id} />
                <AppTooltip content={t("repo_open_on_github_tooltip")}>
                  <a
                    href={repo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:bg-muted text-muted-foreground hover:text-foreground flex h-6 w-6 items-center justify-center rounded opacity-0 transition-opacity not-md:opacity-100 group-hover:opacity-100"
                  >
                    <GitHubIcon className="h-4 w-4" />
                  </a>
                </AppTooltip>
              </div>
            </div>

            <p className="text-muted-foreground line-clamp-2 text-sm wrap-break-word not-sm:text-center">
              {repo.description ?? t("repo_empty_desc")}
            </p>

            <div className="mt-1 flex flex-wrap items-center gap-3 not-md:justify-center">
              <div className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: langColor }} />
                {repo.language !== null && (
                  <AppTooltip content={t("repo_primary_language_tooltip")}>
                    <div className="text-muted-foreground hover:text-foreground flex cursor-help items-center gap-1 text-xs transition-colors">
                      {repo.language}
                    </div>
                  </AppTooltip>
                )}
              </div>
              {metrics.map((m, i) => (
                <RepoMetric
                  key={i}
                  icon={m.icon}
                  label={m.label}
                  tooltip={m.tooltip}
                  color={m.color}
                  className={cn(
                    "text-muted-foreground hover:text-foreground text-xs transition-colors",
                    m.className
                  )}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center text-xs not-sm:gap-2 sm:flex-col md:items-end">
          <div className="flex items-center gap-1 rounded">
            <span className={cn("h-2 w-2 rounded-full", status.color)} />
            <span className="font-medium">{status.label}</span>
          </div>
          {repo.lastAnalysisDate !== null && repo.lastAnalysisDate !== undefined && (
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
        </div>
      </CardContent>
    </Card>
  );
}
