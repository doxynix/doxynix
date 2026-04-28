"use client";

import { useEffect } from "react";
import { FileText } from "lucide-react";
import { parseAsString, parseAsStringEnum, useQueryState } from "nuqs";

import { trpc, type AvailableDocs, type DocType } from "@/shared/api/trpc";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { EmptyState } from "@/shared/ui/kit/empty-state";

import { useRepoParams } from "@/entities/repo/model/use-repo-params";
import { RepoAnalyzeButton } from "@/entities/repo/ui/repo-analyze-button";

import { DocTypeSchema } from "@/generated/zod";

import { RepoDocs } from "./repo-docs";

type Props = { id: string };

const EMPTY_DOCS: AvailableDocs = [];

export function RepoDocsContainer({ id }: Readonly<Props>) {
  const { name, owner } = useRepoParams();
  const [node] = useQueryState("node", parseAsString.withOptions({ shallow: true }));

  const [activeTab, setActiveTab] = useQueryState(
    "type",
    parseAsStringEnum<DocType>(Object.values(DocTypeSchema.enum)).withDefault(
      DocTypeSchema.enum.README
    )
  );

  const { data: availableDocs, isLoading } = trpc.repoDetails.getAvailableDocs.useQuery({
    repoId: id,
  });

  const { data: nodeContext } = trpc.repoDetails.getNodeContext.useQuery(
    { nodeId: node ?? "", repoId: id },
    { enabled: node != null && node.length > 0 }
  );

  const docs = availableDocs ?? EMPTY_DOCS;
  const resolvedActiveTab = docs.some((doc) => doc.type === activeTab) ? activeTab : docs[0]?.type;

  useEffect(() => {
    const preferredDocType = nodeContext?.related.docs[0]?.docType;
    if (preferredDocType == null || docs.length === 0) return;

    const matchingDoc = docs.find((doc) => doc.type === preferredDocType);
    if (matchingDoc == null || matchingDoc.type === resolvedActiveTab) return;

    void setActiveTab(matchingDoc.type);
  }, [docs, nodeContext?.related.docs, resolvedActiveTab, setActiveTab]);

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

  if (resolvedActiveTab == null) {
    return null;
  }

  return (
    <RepoDocs
      activeTab={resolvedActiveTab}
      availableDocs={availableDocs}
      nodeContext={nodeContext ?? null}
      repoId={id}
      onTabChange={(tab) => {
        void setActiveTab(tab);
      }}
    />
  );
}
