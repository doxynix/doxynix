"use client";

import { ExternalLinkIcon } from "lucide-react";

import type { UiRepoDetailed } from "@/shared/api/trpc";
import { Badge } from "@/shared/ui/core/badge";
import { Button } from "@/shared/ui/core/button";
import { GitHubIcon } from "@/shared/ui/icons/github-icon";
import { AppAvatar } from "@/shared/ui/kit/app-avatar";
import { ExternalLink } from "@/shared/ui/kit/external-link";
import { Link } from "@/i18n/routing";

import { repoStatusConfig, repoVisibilityConfig } from "@/entities/repo";

type Props = { repo: UiRepoDetailed };

export function RepoDetailsHeader({ repo }: Readonly<Props>) {
  const visibility = repoVisibilityConfig[repo.visibility];
  const status = repoStatusConfig[repo.status];

  return (
    <div className="mx-auto w-full space-y-4">
      <div className="flex items-center gap-4">
        <AppAvatar alt={repo.owner} src={repo.ownerAvatarUrl} />
        <div className="flex gap-1 text-2xl font-bold">
          <Link href={`/dashboard/repo/${repo.owner}`} className="hover:underline">
            {repo.owner}
          </Link>
          <span>/</span>
          <Link href={`/dashboard/repo/${repo.owner}/${repo.name}`} className="hover:underline">
            {repo.name}
          </Link>
        </div>
        <Badge variant="outline" className={visibility.color}>
          {visibility.label}
        </Badge>
        <Badge variant="outline" className={status.color}>
          {status.label}
        </Badge>
        <Button asChild variant="outline">
          <ExternalLink href={repo.url} className="hover:text-foreground">
            <GitHubIcon className="size-4" /> Github <ExternalLinkIcon className="size-4" />
          </ExternalLink>
        </Button>
      </div>
    </div>
  );
}
