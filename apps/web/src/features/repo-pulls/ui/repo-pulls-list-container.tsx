"use client";
import { useQuery } from "@tanstack/react-query";
import { GitPullRequest } from "lucide-react";
import { useTranslations } from "next-intl";

import { useTRPC } from "@/shared/api/trpc";
import { Link } from "@/shared/i18n/navigation";
import { AppButton } from "@/shared/ui/core/button";
import { GitHubIcon } from "@/shared/ui/icons/github-icon";
import { EmptyState } from "@/shared/ui/kit/empty-state";
import { ExternalLink } from "@/shared/ui/kit/external-link";

import { RepoPullsList } from "./repo-pulls-list";

type Props = { name: string; owner: string; repoId: string };

export function RepoPullsListContainer({ name, owner, repoId }: Readonly<Props>) {
  const trpc = useTRPC();
  const tCommon = useTranslations("Common");
  const t = useTranslations("Dashboard");
  const { data: pulls, isLoading } = useQuery(
    trpc.analysis.listByRepository.queryOptions({
      repoId,
    }),
  );

  if (isLoading) {
    return <div>{tCommon("loading")}</div>;
  }

  if (pulls == null || pulls.items.length === 0) {
    return (
      <div className="flex h-150 items-center justify-center rounded-xl border border-dashed">
        <EmptyState
          action={
            <div className="flex items-center gap-1">
              <AppButton
                asChild
                variant="outline"
              >
                <ExternalLink href={`https://github.com/${owner}/${name}/pulls`}>
                  {t("repo_pull_open_on_github")} <GitHubIcon />
                </ExternalLink>
              </AppButton>
              <AppButton
                asChild
                variant="outline"
              >
                <Link href={`/dashboard/repo/${owner}/${name}/settings`}>
                  {t("repo_pull_enable_analysis")}
                </Link>
              </AppButton>
            </div>
          }
          description={t("repo_pull_empty_desc")}
          icon={GitPullRequest}
          title={t("repo_pull_empty_title")}
        />
      </div>
    );
  }

  return (
    <RepoPullsList
      capped={pulls.capped}
      name={name}
      owner={owner}
      pulls={pulls.items}
      total={pulls.total}
    />
  );
}
