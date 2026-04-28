"use client";

import { Loader2 } from "lucide-react";

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
  const { data: analysis, isLoading: isAnalysisLoading } = trpc.prAnalysis.getByPRNumber.useQuery({
    prNumber,
    repoId,
  });
  const { data: impact, isLoading: isImpactLoading } = trpc.prAnalysis.getImpactByPRNumber.useQuery(
    {
      prNumber,
      repoId,
    }
  );

  if (isAnalysisLoading || isImpactLoading) {
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (analysis == null) return <div>Analysis not found for this PR.</div>;

  const riskScore = impact?.analysis.riskScore ?? analysis.riskScore;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Pull Request #{analysis.prNumber}</h1>
            <AppTooltip content="Open on GitHub">
              <ExternalLink
                href={`https://github.com/${owner}/${name}/pull/${prNumber}`}
                aria-label="Open on Github"
                className="text-muted-foreground hover:text-foreground flex size-6 items-center justify-center"
              >
                <GitHubIcon className="size-4" />
              </ExternalLink>
            </AppTooltip>
          </div>
          <div className="flex items-center gap-1">
            <p className="text-muted-foreground text-sm">{analysis.headSha.slice(0, 7)}</p>
            <CopyButton value={analysis.headSha} tooltipText="Copy SHA" className="opacity-100" />
          </div>
        </div>

        <div className="flex items-center gap-4">
          {riskScore != null && (
            <div className="text-right">
              <p className="text-muted-foreground text-xs">Risk Score</p>
              <p
                className={cn(
                  "text-3xl font-black",
                  riskScore > 7
                    ? "text-destructive"
                    : riskScore > 4
                      ? "text-warning"
                      : "text-success"
                )}
              >
                {riskScore}/10
              </p>
            </div>
          )}
        </div>
      </div>
      <RepoPullDetailsContent
        name={name}
        analysis={analysis}
        impact={impact}
        owner={owner}
        repoId={repoId}
      />
    </div>
  );
}
