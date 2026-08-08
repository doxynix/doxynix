"use client";

import { GitPullRequest } from "lucide-react";

import { trpc } from "@/shared/api/trpc";
import { Link } from "@/shared/i18n/routing";
import { AppButton } from "@/shared/ui/core/button";
import { GitHubIcon } from "@/shared/ui/icons/github-icon";
import { EmptyState } from "@/shared/ui/kit/empty-state";
import { ExternalLink } from "@/shared/ui/kit/external-link";

import { RepoPullsList } from "./repo-pulls-list";

type Props = { name: string; owner: string; repoId: string };

export function RepoPullsListContainer({ name, owner, repoId }: Readonly<Props>) {
  const { data: pulls, isLoading } = trpc.analysis.listByRepository.useQuery({
    repoId,
  });

  if (isLoading) return <div>Loading...</div>;

  if (pulls == null || pulls.length === 0) {
    return (
      <div className="flex h-150 items-center justify-center rounded-xl border border-dashed">
        <EmptyState
          action={
            <div className="flex items-center gap-1">
              <AppButton asChild variant="outline">
                <ExternalLink href={`https://github.com/${owner}/${name}/pulls`}>
                  Open pull on GitHub <GitHubIcon />
                </ExternalLink>
              </AppButton>
              <AppButton asChild variant="outline">
                <Link href={`/dashboard/repo/${owner}/${name}/settings`}>Enable PR analysis</Link>
              </AppButton>
            </div>
          }
          description="Open a PR on GitHub to view its analysis"
          icon={GitPullRequest}
          title="No PRs found"
        />
      </div>
    );
  }

  return <RepoPullsList name={name} owner={owner} pulls={pulls} />;
}
