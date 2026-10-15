"use client";
import { useEffect, useRef } from "react";
import { DocType } from "@doxynix/shared";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsString, parseAsStringEnum, useQueryState } from "nuqs";

import { useTRPC } from "@/shared/api/trpc";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { EmptyState } from "@/shared/ui/kit/empty-state";

import type { AvailableDocs } from "@/entities/repo/model/repo.types";
import { useNodeContext } from "@/entities/repo/model/use-node-context";
import { useRepoParams } from "@/entities/repo/model/use-repo-params";
import { RepoAnalyzeButton } from "@/entities/repo/ui/repo-analyze-button";

import { RepoDocs } from "./repo-docs";

type Props = { id: string };

const EMPTY_DOCS: AvailableDocs = [];

export function RepoDocsContainer({ id }: Readonly<Props>) {
  const trpc = useTRPC();
  const t = useTranslations("Dashboard");
  const { aid, name, owner } = useRepoParams();
  const [node] = useQueryState("node", parseAsString);
  const autoSelectedNodeRef = useRef<null | string>(null);

  const [activeTab, setActiveTab] = useQueryState(
    "type",
    parseAsStringEnum<DocType>(Object.values(DocType)).withDefault(DocType.README),
  );

  const { data: availableDocs, isLoading } = useQuery(
    trpc.analysis.getAvailableDocs.queryOptions({
      aid: aid ?? undefined,
      repoId: id,
    }),
  );

  const { data: nodeContext } = useNodeContext({ aid: aid ?? undefined, nodeId: node, repoId: id });

  const docs = availableDocs ?? EMPTY_DOCS;
  const resolvedActiveTab = docs.some((doc) => doc.type === activeTab) ? activeTab : docs[0]?.type;

  useEffect(() => {
    const nodeId = nodeContext?.node.id ?? null;
    const preferredDocType = nodeContext?.related.docs[0]?.docType;
    if (preferredDocType == null || docs.length === 0) {
      return;
    }

    const matchingDoc = docs.find((doc) => doc.type === preferredDocType);
    if (matchingDoc == null || matchingDoc.type === resolvedActiveTab) {
      return;
    }

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
          action={
            <RepoAnalyzeButton
              name={name}
              owner={owner}
            />
          }
          description={t("repo_docs_empty_desc")}
          icon={FileText}
          title={t("repo_docs_empty_title")}
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
      onTabChange={(tab) => {
        void setActiveTab(tab);
      }}
      repoId={id}
    />
  );
}
