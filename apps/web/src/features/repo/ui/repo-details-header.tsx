"use client";

import { Link } from "@/shared/i18n/navigation";
import { AppBadge } from "@/shared/ui/core/badge";
import { AppButton } from "@/shared/ui/core/button";
import { GitHubIcon } from "@/shared/ui/icons/github-icon";
import { AppAvatar } from "@/shared/ui/kit/app-avatar";
import { ExternalLink } from "@/shared/ui/kit/external-link";

import type { UiRepoDetailed } from "@/entities/repo/model/repo.types";
import { repoStatusConfig } from "@/entities/repo/model/repo-status-config";
import { repoVisibilityConfig } from "@/entities/repo/model/repo-visibility";

import { PrDraftSheet } from "./pr-draft-sheet";
import { RepoVersionSelector } from "./repo-version-selector";

type Props = { repo: UiRepoDetailed };

export function RepoDetailsHeader({ repo }: Readonly<Props>) {
  const visibility = repoVisibilityConfig[repo.visibility];
  const status = repoStatusConfig[repo.status];
  const ownerSlug = encodeURIComponent(repo.owner);
  const repoSlug = encodeURIComponent(repo.name);

  return (
    <div className="mx-auto flex w-full flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center justify-between gap-4">
          <AppAvatar alt={repo.owner} fallbackText={repo.owner} src={repo.ownerAvatarUrl} />
          <h1 className="flex gap-1 font-bold text-2xl">
            <Link className="hover:underline" href={`/dashboard/repo/${ownerSlug}`}>
              {repo.owner}
            </Link>
            <span>/</span>
            <Link className="hover:underline" href={`/dashboard/repo/${ownerSlug}/${repoSlug}`}>
              {repo.name}
            </Link>
          </h1>
          <PrDraftSheet repoId={repo.id} />
          <AppBadge className={visibility.color} variant="outline">
            {visibility.label}
          </AppBadge>
          <AppBadge className={status.color} variant="outline">
            {status.label}
          </AppBadge>
          <AppButton asChild variant="outline">
            <ExternalLink className="hover:text-foreground" href={repo.url}>
              <GitHubIcon className="size-4" /> Github
            </ExternalLink>
          </AppButton>
        </div>
        <RepoVersionSelector repoId={repo.id} />
      </div>
    </div>
  );
}
