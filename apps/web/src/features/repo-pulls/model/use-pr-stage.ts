"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { trpc } from "@/shared/api/trpc";

export function usePrStage(repoId: string) {
  const utils = trpc.useUtils();
  const t = useTranslations("Dashboard");

  const { isPending, mutate } = trpc.analysis.stageGeneratedFix.useMutation({
    onError: (error) => {
      toast.error(t("repo_pull_fix_add_failed", { error: error.message }));
    },
    onSuccess: (data) => {
      toast.success(
        t("repo_pull_fix_added", {
          added: data.stagedFilesAdded,
          total: data.stagedCount,
        }),
      );
      void utils.analysis.getStagedFiles.invalidate();
    },
  });

  return {
    isStaging: isPending,
    stageFix: (fixId: string) => mutate({ fixId, repoId }),
  };
}
