"use client";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { useTRPC } from "@/shared/api/trpc";
import { Card, CardDescription, CardHeader, CardTitle } from "@/shared/ui/core/card";
import { Skeleton } from "@/shared/ui/core/skeleton";

import { DeleteAllReposDialog } from "./delete-all-repos-dialog";

export function DeleteAllReposCard() {
  const trpc = useTRPC();
  const t = useTranslations("Dashboard");
  const { data, isLoading } = useQuery(trpc.repo.getSlim.queryOptions({ limit: 1 }));
  const hasRepos = data != null && data.items.length > 0;

  if (isLoading || !data) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle>{t("settings_danger_delete_all_repos_title")}</CardTitle>
          <CardDescription className="muted-foreground mb-4 flex flex-col">
            <span>{t("settings_danger_delete_all_repos_note_1")}</span>
            <span>{t("settings_danger_delete_all_repos_note_2")}</span>
          </CardDescription>
          <Skeleton className="h-9 w-50" />
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-destructive">
      <CardHeader>
        <CardTitle>{t("settings_danger_delete_all_repos_title")}</CardTitle>
        <CardDescription className="muted-foreground mb-4 flex flex-col">
          <span>{t("settings_danger_delete_all_repos_note_1")}</span>
          <span>{t("settings_danger_delete_all_repos_note_2")}</span>
        </CardDescription>
        <DeleteAllReposDialog hasRepos={hasRepos} />
      </CardHeader>
    </Card>
  );
}
