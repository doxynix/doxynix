"use client";

import { useTranslations } from "next-intl";

import { Card, CardDescription, CardHeader, CardTitle } from "@/shared/ui/core/card";

import { DeleteRepoDialog } from "./delete-repo-dialog";

type Props = { id: string };

export function DeleteRepoCard({ id }: Readonly<Props>) {
  const t = useTranslations("Dashboard");

  return (
    <Card className="border-destructive">
      <CardHeader>
        <CardTitle>{t("settings_danger_delete_all_repos_title")}</CardTitle>
        <CardDescription className="muted-foreground mb-4 flex flex-col">
          <span>{t("settings_danger_delete_all_repos_note_1")}</span>
          <span>{t("settings_danger_delete_all_repos_note_2")}</span>
        </CardDescription>
        <DeleteRepoDialog id={id} />
      </CardHeader>
    </Card>
  );
}
