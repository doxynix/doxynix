"use client";

import { SearchX } from "lucide-react";
import { useTranslations } from "next-intl";

import type { RepoMeta } from "@/shared/api/trpc";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/shared/ui/core/empty";

type Props = { meta: RepoMeta };

export function RepoSearchEmpty({ meta }: Readonly<Props>) {
  const t = useTranslations("Dashboard");

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchX />
        </EmptyMedia>
      </EmptyHeader>
      <EmptyTitle>{t("repo_no_results_found")}</EmptyTitle>
      <EmptyDescription>
        {meta.searchQuery !== "" && meta.searchQuery != null ? (
          <span>
            {t("repo_no_results_found_for")}{" "}
            <span className="italic">{`"${meta.searchQuery}"`}</span>
          </span>
        ) : (
          <span>{t("repo_change_filters")}</span>
        )}
      </EmptyDescription>
    </Empty>
  );
}
