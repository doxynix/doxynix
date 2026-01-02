"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/shared/lib/utils";
import { AppTooltip } from "@/shared/ui/AppTooltip";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import GitHubIcon from "@/shared/ui/github-icon";
import { getLanguageColor } from "@/features/repo/model/language-colors";
import { getMetrics } from "@/features/repo/model/metrics";
import { repoStatusConfig } from "@/features/repo/model/repo-status";
import { repoVisibilityConfig } from "@/features/repo/model/repo-visibility";
import { RepoAvatar } from "@/features/repo/ui/RepoAvatar";
import { RepoCardProps } from "@/features/repo/ui/RepoCard/types";
import { RepoMetric } from "@/features/repo/ui/RepoMetric/ui";

export function RepoCard({ repo }: RepoCardProps) {
  const [copied, setCopied] = useState(false);

  const visibility = repoVisibilityConfig[repo.visibility];
  const status = repoStatusConfig[repo.status];
  const metrics = getMetrics(repo);
  const langColor = getLanguageColor(repo.language);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(repo.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      toast.error("Ошибка при копировании ID");
    }
  };

  return (
    <Card className="group relative flex overflow-hidden p-4">
      <CardContent className="flex flex-wrap items-end justify-between">
        <div className="flex flex-wrap gap-2 sm:flex-nowrap">
          <RepoAvatar src={repo.ownerAvatarUrl ?? "/avatar-placeholder.png"} alt={repo.owner} />
          <div className="flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2 truncate">
                <div>
                  <Link href={`/repo/${repo.owner}`} className="truncate font-bold hover:underline">
                    <span className="text-muted-foreground">{repo.owner}</span>
                  </Link>
                  <Link
                    href={`/repo/${repo.owner}/${repo.name}`}
                    className="truncate font-bold hover:underline"
                  >
                    <span>/{repo.name}</span>
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
                  className={cn(
                    "flex shrink-0 items-center gap-1 transition-opacity duration-200",
                    copied ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  )}
                >
                  <AppTooltip content={copied ? "Скопировано!" : "Копировать ID"}>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleCopy}
                      className={cn(
                        "h-6 w-6 transition-all",
                        copied
                          ? "text-success hover:text-success"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </AppTooltip>
                  <AppTooltip content="Открыть на GitHub">
                    <a
                      href={repo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:bg-muted text-muted-foreground hover:text-foreground flex h-6 w-6 items-center justify-center rounded"
                    >
                      <GitHubIcon className="h-4 w-4" />
                    </a>
                  </AppTooltip>
                </div>
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
          <div className="flex items-center gap-1 rounded py-0.5 sm:px-2">
            <span className={cn("h-2 w-2 rounded-full", status.color)} />
            <span className="font-medium">{status.label}</span>
          </div>
          <div className="text-muted-foreground">
            {repo.lastAnalysisDate ? (
              <AppTooltip content={new Date(repo.lastAnalysisDate).toLocaleString("ru-RU")}>
                <span>
                  {formatDistanceToNow(new Date(repo.lastAnalysisDate), {
                    addSuffix: true,
                    locale: ru,
                  })}
                </span>
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
