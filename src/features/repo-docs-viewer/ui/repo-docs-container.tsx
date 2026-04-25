"use client";

import { FileText } from "lucide-react";
import { parseAsStringEnum, useQueryState } from "nuqs";

import { trpc, type DocType } from "@/shared/api/trpc";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { EmptyState } from "@/shared/ui/kit/empty-state";

import { useRepoParams } from "@/entities/repo/model/use-repo-params";
import { RepoAnalyzeButton } from "@/entities/repo/ui/repo-analyze-button";

import { DocTypeSchema } from "@/generated/zod";

import { RepoDocs } from "./repo-docs";

type Props = { id: string };

export function RepoDocsContainer({ id }: Readonly<Props>) {
  const { name, owner } = useRepoParams();

  const [activeTab, setActiveTab] = useQueryState(
    "type",
    parseAsStringEnum<DocType>(Object.values(DocTypeSchema.enum)).withDefault(
      DocTypeSchema.enum.README
    )
  );

  const { data: availableDocs, isLoading } = trpc.repoDetails.getAvailableDocs.useQuery({
    repoId: id,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-100" />
        <Skeleton className="h-125 w-full" />
      </div>
    );
  }

  if (availableDocs == null || availableDocs.length === 0) {
    return (
      <div className="flex h-150 items-center justify-center rounded-xl border border-dashed">
        <EmptyState
          action={<RepoAnalyzeButton name={name} owner={owner} />}
          description="Run AI analysis to automatically generate README, API specs, and architecture docs."
          icon={FileText}
          title="No documentation generated"
        />
      </div>
    );
  }

  const resolvedActiveTab = availableDocs.some((doc) => doc.type === activeTab)
    ? activeTab
    : availableDocs[0]?.type;

  if (resolvedActiveTab == null) {
    return null;
  }

  return (
    <RepoDocs
      activeTab={resolvedActiveTab}
      availableDocs={availableDocs}
      repoId={id}
      onTabChange={(tab) => {
        void setActiveTab(tab);
      }}
    />
  );
}
