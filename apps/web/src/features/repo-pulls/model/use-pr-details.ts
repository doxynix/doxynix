import { useEffect } from "react";
import { skipToken, useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useTRPC } from "@/shared/api/trpc";
import { PR_COMMENTS_PAGE_SIZE, PR_FIXES_PAGE_SIZE } from "@/shared/config/repos";
import { commentToFinding } from "@/shared/lib/comment-to-finding";
import { trackClientEvent } from "@/shared/lib/posthog-client";

import type { PRNumber } from "@/entities/pr/model/pr.types";

import { usePrStage } from "./use-pr-stage";

type Options = {
  analysis: PRNumber;
  impact: PRNumber;
  repoId: string;
};

type RenderedComment = {
  bodyHtml: string;
  filePath: string;
  findingType: string;
  id: string;
  line: number;
  riskLevel: number;
};

export function usePrDetails({ analysis, impact, repoId }: Options) {
  const trpc = useTRPC();
  const t = useTranslations("Dashboard");

  const prAnalysisId = analysis?.analysis.id;
  const commentsInput =
    prAnalysisId == null ? skipToken : { analysisId: prAnalysisId, limit: PR_COMMENTS_PAGE_SIZE };

  const {
    data: commentsData,
    fetchNextPage: fetchNextCommentsPage,
    hasNextPage: hasNextCommentsPage,
    isFetchingNextPage: isFetchingNextCommentsPage,
    isLoading: isCommentsLoading,
  } = useInfiniteQuery(
    trpc.analysis.getComments.infiniteQueryOptions(commentsInput, {
      getNextPageParam: (page) => page.meta.nextCursor,
    }),
  );

  const {
    data: fixesData,
    fetchNextPage: fetchNextFixesPage,
    hasNextPage: hasNextFixesPage,
    isFetchingNextPage: isFetchingNextFixesPage,
  } = useInfiniteQuery(
    trpc.analysis.listFixes.infiniteQueryOptions(
      prAnalysisId == null ? skipToken : { limit: PR_FIXES_PAGE_SIZE, prAnalysisId },
      { getNextPageParam: (page) => page.meta.nextCursor },
    ),
  );

  const { isStaging, stageFix } = usePrStage(repoId);

  const findingsCount = impact?.summary.findings ?? 0;
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

  const onFixQueued = (data: { fixId?: string; success?: boolean }) => {
    if (data.success === true && data.fixId != null) {
      toast.success(t("repo_pull_fix_queued"), {
        description: t("repo_pull_fix_queued_desc"),
      });
      trackClientEvent("fix_requested", {
        findings_count: findingsCount,
        fix_id: data.fixId,
        repo_id: repoId,
      });
    }
  };

  const onFixError = (err: { message: string }) => {
    toast.error(t("repo_pull_fix_error"), {
      description: err.message,
    });
  };

  const createFixMutation = useMutation(
    trpc.analysis.createFix.mutationOptions({ onError: onFixError, onSuccess: onFixQueued }),
  );

  const fixAllMutation = useMutation(
    trpc.analysis.fixAllComments.mutationOptions({ onError: onFixError, onSuccess: onFixQueued }),
  );

  const fixOne = (comment: RenderedComment) => {
    createFixMutation.mutate({
      findings: [
        commentToFinding({
          filePath: comment.filePath,
          findingType: comment.findingType,
          line: comment.line,
          suggestion: comment.bodyHtml,
        }),
      ],
      prAnalysisId,
      repoId,
    });
  };

  const fixAll = () => {
    if (prAnalysisId == null) {
      return;
    }

    fixAllMutation.mutate({ prAnalysisId });
  };

  const comments = commentsData?.pages.flatMap((page) => page.renderedComments) ?? [];
  const fixes = fixesData?.pages.flatMap((page) => page.items) ?? [];

  return {
    comments,
    commentsTotal: commentsData?.pages[0]?.total ?? null,
    fetchNextCommentsPage,
    fetchNextFixesPage,
    fixAll,
    fixes,
    fixOne,
    hasNextCommentsPage,
    hasNextFixesPage,
    isCommentsLoading,
    isFetchingNextCommentsPage,
    isFetchingNextFixesPage,
    isFixing: createFixMutation.isPending || fixAllMutation.isPending,
    isStaging,
    stageFix,
  };
}
