"use client";

import { toast } from "sonner";

import { trpc } from "@/shared/api/trpc";

export function usePrStage(repoId: string) {
  const utils = trpc.useUtils();

  const { isPending, mutate } = trpc.prStaging.stageGeneratedFix.useMutation({
    onError: (error) => {
      toast.error(`Failed to add fix: ${error.message}`);
    },
    onSuccess: (data) => {
      toast.success(
        `Added ${data.stagedFilesAdded} file(s) to PR draft. Total: ${data.stagedCount}.`
      );
      void utils.prStaging.getStagedFiles.invalidate({ repoId });
    },
  });

  return {
    isStaging: isPending,
    stageFix: (fixId: string) => mutate({ fixId, repoId }),
  };
}
