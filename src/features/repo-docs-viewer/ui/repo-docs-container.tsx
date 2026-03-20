"use client";

import { FileText } from "lucide-react";
import { parseAsStringEnum, useQueryState } from "nuqs";

import { trpc, type DocType } from "@/shared/api/trpc";
import { Skeleton } from "@/shared/ui/core/skeleton";

import { DocTypeSchema } from "@/generated/zod";

import { RepoDocs } from "./repo-docs";

type Props = { id: string };

export function RepoDocsContainer({ id }: Readonly<Props>) {
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

  if (!availableDocs || availableDocs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-20 text-center">
        <FileText className="text-muted-foreground mb-4 size-12 opacity-20" />
        <h3 className="text-lg font-medium">No documentation generated yet</h3>
        <p className="text-muted-foreground text-sm">Run a full analysis to generate docs.</p>
      </div>
    );
  }

  return (
    <RepoDocs
      activeTab={activeTab}
      availableDocs={availableDocs}
      repoId={id}
      onTabChange={(tab) => {
        void setActiveTab(tab);
      }}
    />
  );
}
