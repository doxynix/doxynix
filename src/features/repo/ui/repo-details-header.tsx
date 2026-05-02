"use client";

import { Badge } from "@/shared/ui/core/badge";
import { Button } from "@/shared/ui/core/button";
import { GitHubIcon } from "@/shared/ui/icons/github-icon";
import { AppAvatar } from "@/shared/ui/kit/app-avatar";
import { ExternalLink } from "@/shared/ui/kit/external-link";
import { Link } from "@/i18n/routing";

import { repoStatusConfig } from "@/entities/repo/model/repo-status-config";
import { repoVisibilityConfig } from "@/entities/repo/model/repo-visibility";
import type { UiRepoDetailed } from "@/entities/repo/model/repo.types";

import { PrDraftSheet } from "./pr-draft-sheet";

type Props = { repo: UiRepoDetailed };

export function RepoDetailsHeader({ repo }: Readonly<Props>) {
  const visibility = repoVisibilityConfig[repo.visibility];
  const status = repoStatusConfig[repo.status];
  const ownerSlug = encodeURIComponent(repo.owner);
  const repoSlug = encodeURIComponent(repo.name);

  return (
    <div className="mx-auto w-full space-y-4">
      <div className="flex items-center gap-4">
        <AppAvatar alt={repo.owner} src={repo.ownerAvatarUrl} />
        <h1 className="flex gap-1 text-2xl font-bold">
          <Link href={`/dashboard/repo/${ownerSlug}`} className="hover:underline">
            {repo.owner}
          </Link>
          <span>/</span>
          <Link href={`/dashboard/repo/${ownerSlug}/${repoSlug}`} className="hover:underline">
            {repo.name}
          </Link>
        </h1>
        <PrDraftSheet repoId={repo.id} />
        <Badge variant="outline" className={visibility.color}>
          {visibility.label}
        </Badge>
        <Badge variant="outline" className={status.color}>
          {status.label}
        </Badge>
        <Button asChild variant="outline">
          <ExternalLink href={repo.url} className="hover:text-foreground">
            <GitHubIcon className="size-4" /> Github
          </ExternalLink>
        </Button>
      </div>
    </div>
  );
}
