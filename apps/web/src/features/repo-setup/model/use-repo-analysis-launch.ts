import { useState } from "react";
import { DocType } from "@doxynix/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocale } from "next-intl";

import { useTRPC } from "@/shared/api/trpc";
import { useRouter } from "@/shared/i18n/navigation";
import { trackClientEvent } from "@/shared/lib/posthog-client";

import type { UiRepoDetailed } from "@/entities/repo/model/repo.types";
import type { FileTuple } from "@/entities/repo/model/repo-setup.types";

import { resolveSelectedFiles } from "./analysis-payload";

type Options = {
  branch: string;
  files: FileTuple[] | undefined;
  initialDocTypes?: DocType[];
  repo: UiRepoDetailed;
  selectedIds: Set<string>;
};

export function useRepoAnalysisLaunch({
  branch,
  files,
  initialDocTypes,
  repo,
  selectedIds,
}: Options) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const locale = useLocale();

  const [analysisLocale, setAnalysisLocale] = useState(locale);
  const [instructions, setInstructions] = useState("");
  const [selectedDocs, setSelectedDocs] = useState<DocType[]>(initialDocTypes ?? [DocType.README]);

  const mutation = useMutation(
    trpc.analysis.analyze.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(
          trpc.analysis.getLatest.queryFilter({ repoId: repo.id }),
        );

        router.refresh();
      },
    }),
  );

  const start = () => {
    if (files == null) {
      return;
    }

    const selectedFiles = resolveSelectedFiles(files, selectedIds);

    mutation.mutate({
      branch,
      docTypes: selectedDocs,
      files: selectedFiles,
      instructions,
      language: analysisLocale,
      repoId: repo.id,
    });

    trackClientEvent("repo_analysis_started", {
      branch,
      doc_types: selectedDocs,
      has_custom_instructions: instructions.length > 0,
      language: analysisLocale,
      repo_id: repo.id,
      repo_name: repo.name,
      repo_owner: repo.owner,
      selected_files_count: selectedFiles.length,
    });
  };

  const toggleDocType = (id: DocType) => {
    setSelectedDocs((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  return {
    analysisLocale,
    error: mutation.error,
    instructions,
    isPending: mutation.isPending,
    resetAnalysisError: () => mutation.reset(),
    selectedDocs,
    setAnalysisLocale,
    setInstructions,
    start,
    toggleDocType,
  };
}
