import { getTranslations } from "next-intl/server";

import { Card, CardDescription, CardHeader, CardTitle } from "@/shared/ui/core/card";

import { api } from "@/server/trpc/server";
import { DeleteAllReposDialog } from "./delete-all-repos-dialog";

export async function DeleteAllReposCard() {
  const limit = 1;
  const page = 1;

  const { meta } = await (
    await api()
  ).repo.getAll({
    cursor: page,
    limit,
  });

  const t = await getTranslations("Dashboard");

  return (
    <Card className="border-destructive">
      <CardHeader>
        <CardTitle>{t("settings_danger_delete_all_repos_title")}</CardTitle>
        <CardDescription className="muted-foreground mb-4 flex flex-col">
          <span>{t("settings_danger_delete_all_repos_note_1")}</span>
          <span>{t("settings_danger_delete_all_repos_note_2")}</span>
        </CardDescription>
        <DeleteAllReposDialog meta={meta} />
      </CardHeader>
    </Card>
  );
}
