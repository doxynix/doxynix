import { useEffect } from "react";
import { skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useTRPC } from "@/shared/api/trpc";
import { trackClientEvent } from "@/shared/lib/posthog-client";

import type { PRNumber } from "@/entities/pr/model/pr.types";

import { toFixFinding } from "./pr-details";
import { usePrStage } from "./use-pr-stage";

type Options = {
  analysis: PRNumber;
  impact: PRNumber;
  repoId: string;
};

export function usePrDetails({ analysis, impact, repoId }: Options) {
  const trpc = useTRPC();
  const t = useTranslations("Dashboard");
  const queryClient = useQueryClient();

  const { data: comments, isLoading: isCommentsLoading } = useQuery(
    trpc.analysis.getComments.queryOptions(
      analysis?.analysis.id ? { analysisId: analysis.analysis.id } : skipToken,
    ),
  );

  const { isStaging, stageFix } = usePrStage(repoId);

  const findingsCount = impact?.summary.findings ?? 0;
  const prAnalysisId = analysis?.analysis.id;
  const riskScore = impact?.analysis.riskScore ?? analysis?.analysis.riskScore;

  useEffect(() => {
    if (prAnalysisId == null) {
      return;
    }

    trackClientEvent("pr_findings_viewed", {
      findings_count: findingsCount,
      pr_analysis_id: prAnalysisId,
      pr_number: analysis?.analysis.prNumber ?? 0,
      repo_id: repoId,
      risk_score: riskScore ?? 0,
    });
  }, [analysis?.analysis.prNumber, findingsCount, prAnalysisId, repoId, riskScore]);

  const createFixMutation = useMutation(
    trpc.analysis.createFix.mutationOptions({
      onError: (err) => {
        toast.error(t("repo_pull_fix_error"), {
          description: err.message,
        });
      },
      onSuccess: (data) => {
        if (data.success === true && data.fixId != null) {
          toast.success(t("repo_pull_fix_queued"), {
            description: t("repo_pull_fix_queued_desc"),
          });
          trackClientEvent("fix_requested", {
            findings_count: findingsCount,
            fix_id: data.fixId,
            repo_id: repoId,
          });
          void queryClient.invalidateQueries(trpc.analysis.getByRepository.queryFilter({ repoId }));
        }
      },
    }),
  );

  const fixOne = (comment: Parameters<typeof toFixFinding>[0]) => {
    createFixMutation.mutate({
      findings: [toFixFinding(comment)],
      prAnalysisId: analysis?.analysis.id,
      repoId,
    });
  };

  const fixAll = () => {
    if (comments == null || comments.renderedComments.length === 0) {
      return;
    }

    createFixMutation.mutate({
      findings: comments.renderedComments.map((comment) => toFixFinding(comment)),
      prAnalysisId: analysis?.analysis.id,
      repoId,
    });
  };

  return {
    comments,
    fixAll,
    fixOne,
    isCommentsLoading,
    isFixing: createFixMutation.isPending,
    isStaging,
    stageFix,
  };
}
