"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useTRPC } from "@/shared/api/trpc";
import { trackClientEvent } from "@/shared/lib/posthog-client";

export function usePrStage(repoId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations("Dashboard");

  const { isPending, mutate } = useMutation(
    trpc.analysis.stageGeneratedFix.mutationOptions({
      onError: (error) => {
        toast.error(t("repo_pull_fix_add_failed", { error: error.message }));
      },
      onSuccess: (data) => {
        trackClientEvent("fix_staged", {
          repo_id: repoId,
          staged_files: data.stagedFilesAdded,
        });
        toast.success(
          t("repo_pull_fix_added", {
            added: data.stagedFilesAdded,
            total: data.stagedCount,
          }),
        );
        void queryClient.invalidateQueries(trpc.analysis.getStagedFiles.pathFilter());
      },
    }),
  );

  return {
    isStaging: isPending,
    stageFix: (fixId: string) => mutate({ fixId, repoId }),
  };
}
