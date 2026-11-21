"use client";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { useTRPC } from "@/shared/api/trpc";
import { Card, CardDescription, CardTitle } from "@/shared/ui/core/card";

import { DeleteAllReposDialog } from "./delete-all-repos-dialog";

export function DeleteAllReposCard() {
  const trpc = useTRPC();
  const t = useTranslations("Dashboard");
  const { data } = useQuery(trpc.repo.getSlim.queryOptions({ limit: 1 }));
  const hasRepos = data != null && data.items.length > 0;

  return (
    <Card
      className="items-center"
      size="row"
      tone="danger"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <CardTitle className="text-sm">{t("settings_danger_delete_all_repos_title")}</CardTitle>
        <CardDescription className="text-xs leading-5">
          {t("settings_danger_delete_all_repos_note_1")}{" "}
          {t("settings_danger_delete_all_repos_note_2")}
        </CardDescription>
      </div>
      <DeleteAllReposDialog hasRepos={hasRepos} />
    </Card>
  );
}
