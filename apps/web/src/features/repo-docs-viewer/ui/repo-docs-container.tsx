"use client";
import { useEffect, useRef } from "react";
import { DocType } from "@doxynix/shared";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsString, parseAsStringEnum, useQueryState } from "nuqs";

import { useTRPC } from "@/shared/api/trpc";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { SkeletonList, SkeletonText } from "@/shared/ui/kit/app-skeleton";
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
      <div className="flex h-[calc(100dvh-250px)] w-full flex-row gap-10">
        <div className="flex w-72 shrink-0 flex-col gap-4">
          <SkeletonText
            lines={1}
            widths={["w-40"]}
          />

          <SkeletonList
            className="flex flex-col gap-1"
            count={5}
            itemClassName="flex w-full items-center justify-start gap-3 p-3"
            renderItem={() => (
              <>
                <Skeleton className="size-6" />
                <SkeletonText
                  lines={1}
                  widths={["w-28"]}
                />
              </>
            )}
          />
        </div>

        <div className="relative flex flex-1 flex-col rounded-xl border bg-card">
          <div className="flex-none px-8 pt-8 md:px-12">
            <div className="mb-6 flex items-center justify-between border-b pb-6">
              <div className="flex items-center gap-4">
                <Skeleton className="size-10 rounded-md" />
                <div className="flex flex-col gap-1">
                  <SkeletonText
                    lines={1}
                    widths={["w-56"]}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <SkeletonText
                      lines={1}
                      widths={["w-32"]}
                    />
                    <SkeletonText
                      lines={1}
                      widths={["w-40"]}
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="size-9 rounded-xl" />
                <Skeleton className="size-8 rounded-xl" />
              </div>
            </div>
          </div>

          <div className="flex w-full flex-1 flex-col gap-6 px-8 pb-12 md:px-12">
            <SkeletonText
              lines={1}
              widths={["w-1/3"]}
            />
            <SkeletonText
              className="gap-2"
              lines={8}
              widths={["w-full"]}
            />
          </div>
        </div>
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
