"use client";

import { useEffect, useRef } from "react";
import { FileText } from "lucide-react";
import { parseAsString, parseAsStringEnum, useQueryState } from "nuqs";

import { DocTypeSchema } from "@/shared/api-contracts";
import { trpc } from "@/shared/api/trpc";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { EmptyState } from "@/shared/ui/kit/empty-state";

import type { AvailableDocs, DocType } from "@/entities/repo/model/repo.types";
import { useRepoParams } from "@/entities/repo/model/use-repo-params";
import { RepoAnalyzeButton } from "@/entities/repo/ui/repo-analyze-button";

import { RepoDocs } from "./repo-docs";

type Props = { id: string };

const EMPTY_DOCS: AvailableDocs = [];

export function RepoDocsContainer({ id }: Readonly<Props>) {
  const { aid, name, owner } = useRepoParams();
  const [node] = useQueryState("node", parseAsString);
  const autoSelectedNodeRef = useRef<null | string>(null);

  const [activeTab, setActiveTab] = useQueryState(
    "type",
    parseAsStringEnum<DocType>(Object.values(DocTypeSchema.enum)).withDefault(
      DocTypeSchema.enum.README
    )
  );

  const { data: availableDocs, isLoading } = trpc.analysis.getAvailableDocs.useQuery({
    aid: aid ?? undefined,
    repoId: id,
  });

  const { data: nodeContext } = trpc.analysis.getNodeContext.useQuery(
    { aid: aid ?? undefined, nodeId: node ?? "", repoId: id },
    { enabled: node != null && node.length > 0 }
  );

  const docs = availableDocs ?? EMPTY_DOCS;
  const resolvedActiveTab = docs.some((doc) => doc.type === activeTab) ? activeTab : docs[0]?.type;

  useEffect(() => {
    const nodeId = nodeContext?.node.id ?? null;
    const preferredDocType = nodeContext?.related.docs[0]?.docType;
    if (preferredDocType == null || docs.length === 0) return;

    const matchingDoc = docs.find((doc) => doc.type === preferredDocType);
    if (matchingDoc == null || matchingDoc.type === resolvedActiveTab) return;

    if (nodeId != null && autoSelectedNodeRef.current !== nodeId) {
      autoSelectedNodeRef.current = nodeId;
      void setActiveTab(matchingDoc.type);
    }
  }, [docs, resolvedActiveTab, setActiveTab, nodeContext?.node.id, nodeContext?.related.docs]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
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
