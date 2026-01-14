import Link from "next/link";

import { cn, formatFullDate, formatRelativeTime } from "@/shared/lib/utils";
import { AppTooltip } from "@/shared/ui/AppTooltip";
import { Card, CardContent } from "@/shared/ui/card";
import { CopyButton } from "@/shared/ui/CopyButton";
import GitHubIcon from "@/shared/ui/github-icon";

import { getLanguageColor } from "../model/language-colors";
import { getMetrics } from "../model/metrics";
import { repoStatusConfig } from "../model/repo-status";
import { repoVisibilityConfig } from "../model/repo-visibility";
import { RepoTableItem } from "../model/types";
import { RepoAvatar } from "./RepoAvatar";
import { RepoMetric } from "./RepoMetric";

type Props = {
  repo: RepoTableItem;
};

export function RepoCard({ repo }: Props) {
  const visibility = repoVisibilityConfig[repo.visibility];
  const status = repoStatusConfig[repo.status];
  const metrics = getMetrics(repo);
  const langColor = getLanguageColor(repo.language);

  return (
    <Card className="group relative flex overflow-hidden p-4">
      <CardContent className="flex flex-wrap items-end justify-between">
        <div className="flex flex-wrap gap-2 sm:flex-nowrap">
          <RepoAvatar src={repo.ownerAvatarUrl ?? "/avatar-placeholder.png"} alt={repo.owner} />
          <div className="flex flex-col justify-between">
            <div className="flex min-w-0 items-center gap-2 truncate">
              <div>
                <Link
                  href={`/dashboard/repo/${repo.owner}`}
                  className="truncate font-bold hover:underline"
                >
                  <span className="text-muted-foreground">{repo.owner}/</span>
                </Link>
                <Link
                  href={`/dashboard/repo/${repo.owner}/${repo.name}`}
                  className="truncate font-bold hover:underline"
                >
                  <span>{repo.name}</span>
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
                <AppTooltip content="Открыть на GitHub">
                  <a
                    href={repo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:bg-muted text-muted-foreground hover:text-foreground flex h-6 w-6 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <GitHubIcon className="h-4 w-4" />
                  </a>
                </AppTooltip>
              </div>
            </div>

            <p className="text-muted-foreground max-w-230 truncate text-sm">
              {repo.description ?? "Нет описания"}
            </p>

            <div className="mt-1 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: langColor }} />
                {repo.language !== null && (
                  <AppTooltip content="Основной язык">
                    <div className="text-muted-foreground hover:text-foreground flex cursor-help items-center gap-1 text-xs">
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
                    "text-muted-foreground/80 hover:text-foreground text-xs transition-colors",
                    m.className
                  )}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col text-xs sm:items-end">
          <div className="flex items-center gap-1 rounded">
            <span className={cn("h-2 w-2 rounded-full", status.color)} />
            <span className="font-medium">{status.label}</span>
          </div>
          <div className="text-muted-foreground">
            {repo.lastAnalysisDate !== null && repo.lastAnalysisDate !== undefined ? (
              <AppTooltip
                content={`Дата последнего анализа: ${formatFullDate(repo.lastAnalysisDate)}`}
              >
                <span>{formatRelativeTime(repo.lastAnalysisDate)}</span>
              </AppTooltip>
            ) : (
              <span className="opacity-40">—</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
