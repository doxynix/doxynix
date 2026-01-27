"use client";

import { useTranslations } from "next-intl";

import { trpc } from "@/shared/api/trpc";
import { Card, CardDescription, CardHeader, CardTitle } from "@/shared/ui/core/card";
import { Skeleton } from "@/shared/ui/core/skeleton";

import { DeleteAllReposDialog } from "./delete-all-repos-dialog";

export function DeleteAllReposCard() {
  const t = useTranslations("Dashboard");
  const { data, isLoading } = trpc.repo.getAll.useQuery({ limit: 1 });

  if (isLoading || !data)
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

  return (
    <Card className="border-destructive">
      <CardHeader>
        <CardTitle>{t("settings_danger_delete_all_repos_title")}</CardTitle>
        <CardDescription className="muted-foreground mb-4 flex flex-col">
          <span>{t("settings_danger_delete_all_repos_note_1")}</span>
          <span>{t("settings_danger_delete_all_repos_note_2")}</span>
        </CardDescription>
        <DeleteAllReposDialog meta={data.meta} />
      </CardHeader>
    </Card>
  );
}
