"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { trpc } from "@/shared/api/trpc";
import { cn } from "@/shared/lib/cn";
import { GitHubIcon } from "@/shared/ui/icons/github-icon";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";
import { CopyButton } from "@/shared/ui/kit/copy-button";
import { ExternalLink } from "@/shared/ui/kit/external-link";

import { RepoPullDetailsContent } from "./repo-pull-details-content";

type Props = {
  name: string;
  owner: string;
  prNumber: number;
  repoId: string;
};

export function RepoPullDetailContainer({ name, owner, prNumber, repoId }: Readonly<Props>) {
  const t = useTranslations("Dashboard");
  const { data: analysis, isLoading: isAnalysisLoading } = trpc.analysis.getByPRNumber.useQuery({
    prNumber,
    repoId,
  });
  const { data: impact, isLoading: isImpactLoading } = trpc.analysis.getImpactByPRNumber.useQuery({
    prNumber,
    repoId,
  });

  if (isAnalysisLoading || isImpactLoading) {
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (analysis == null) {
    return <div>{t("repo_pull_not_found")}</div>;
  }

  const riskScore = impact?.analysis.riskScore ?? analysis.analysis.riskScore;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-2xl">
              {t("repo_pull_title_prefix")}#{analysis.analysis.prNumber}
            </h1>
            <AppTooltip content={t("repo_open_on_github_tooltip")}>
              <ExternalLink
                aria-label={t("repo_open_on_github_tooltip")}
                className="flex size-6 items-center justify-center text-muted-foreground hover:text-foreground"
                href={`https://github.com/${owner}/${name}/pull/${prNumber}`}
              >
                <GitHubIcon className="size-4" />
              </ExternalLink>
            </AppTooltip>
          </div>
          <div className="flex items-center gap-1">
            <p className="text-muted-foreground text-sm">{analysis.analysis.headSha.slice(0, 7)}</p>
            <CopyButton
              className="opacity-100"
              tooltipText={t("repo_pull_copy_sha")}
              value={analysis.analysis.headSha}
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          {riskScore != null && (
            <div className="text-right">
              <p className="text-muted-foreground text-xs">{t("repo_pull_risk_score")}</p>
              <p
                className={cn(
                  "font-black text-3xl",
                  riskScore > 7
                    ? "text-destructive"
                    : riskScore > 4
                      ? "text-warning"
                      : "text-success",
                )}
              >
                {riskScore}
                /10
              </p>
            </div>
          )}
        </div>
      </div>
      <RepoPullDetailsContent
        analysis={analysis}
        impact={impact ?? null}
        name={name}
        owner={owner}
        repoId={repoId}
      />
    </div>
  );
}
