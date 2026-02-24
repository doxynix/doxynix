"use client";

import { useLocale } from "next-intl";

import type { UiRepoDetailed } from "@/shared/api/trpc";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/core/badge";

import {
  getGitMetrics,
  RepoAvatar,
  RepoGitMetric,
  RepoTopics,
  repoVisibilityConfig,
} from "@/entities/repo";

type Props = { repo: UiRepoDetailed };

export function RepoDetailsHeader({ repo }: Readonly<Props>) {
  const locale = useLocale();

  const gitMetrics = getGitMetrics(repo, locale);
  const visibility = repoVisibilityConfig[repo.visibility];

  return (
    <div className="mx-auto w-full space-y-4">
      <div className="flex items-center gap-4">
        <RepoAvatar alt={repo.owner} src={repo.ownerAvatarUrl ?? "/avatar-placeholder.png"} />
        <h1 className="flex items-center text-2xl font-bold">
          {repo.owner} / {repo.name}
        </h1>
        <Badge variant="outline" className={cn(visibility.color)}>
          {visibility.label}
        </Badge>
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
      <RepoTopics repoTopics={repo.topics} />
      <p className="text-muted-foreground">{repo.description}</p>
    </div>
  );
}
