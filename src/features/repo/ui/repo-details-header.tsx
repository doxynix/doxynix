"use client";

import { ExternalLinkIcon } from "lucide-react";
import { useLocale } from "next-intl";

import type { UiRepoDetailed } from "@/shared/api/trpc";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/core/badge";
import { Button } from "@/shared/ui/core/button";
import { GitHubIcon } from "@/shared/ui/icons/github-icon";
import { AppAvatar } from "@/shared/ui/kit/app-avatar";
import { ExternalLink } from "@/shared/ui/kit/external-link";

import {
  getGitMetrics,
  RepoGitMetric,
  repoStatusConfig,
  RepoTopics,
  repoVisibilityConfig,
} from "@/entities/repo";

type Props = { repo: UiRepoDetailed };

export function RepoDetailsHeader({ repo }: Readonly<Props>) {
  const locale = useLocale();

  const gitMetrics = getGitMetrics(repo, locale);
  const visibility = repoVisibilityConfig[repo.visibility];
  const status = repoStatusConfig[repo.status];

  return (
    <div className="mx-auto w-full space-y-4">
      <div className="flex items-center gap-4">
        <AppAvatar alt={repo.owner} src={repo.ownerAvatarUrl} />
        <h1 className="flex items-center text-2xl font-bold">
          {repo.owner} / {repo.name}
        </h1>
        <Badge variant="outline" className={visibility.color}>
          {visibility.label}
        </Badge>
        <Badge variant="outline" className={status.color}>
          {status.label}
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
        <Button asChild variant="outline">
          <ExternalLink href={repo.url} className="hover:text-foreground">
            <GitHubIcon className="size-4" /> Github <ExternalLinkIcon className="size-4" />
          </ExternalLink>
        </Button>
        {/* <Button asChild variant="outline">
          <ExternalLink href={`/v/${repo.owner}/${repo.name}`} className="hover:text-foreground">
            Docs <ExternalLinkIcon className="size-4" />
          </ExternalLink>
        </Button> */}
      </div>
      <RepoTopics repoTopics={repo.topics} />
      <p className="text-muted-foreground">{repo.description}</p>
    </div>
  );
}
