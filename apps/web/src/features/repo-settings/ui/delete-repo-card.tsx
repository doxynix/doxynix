"use client";

import { useTranslations } from "next-intl";

import { Card, CardDescription, CardTitle } from "@/shared/ui/core/card";

import { DeleteRepoDialog } from "./delete-repo-dialog";

type Props = { id: string; name: string };

export function DeleteRepoCard({ id, name }: Readonly<Props>) {
  const t = useTranslations("Dashboard");

  return (
    <Card
      className="items-center"
      size="row"
      tone="danger"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <CardTitle className="text-sm">{t("settings_repo_delete_title")}</CardTitle>
        <CardDescription className="text-xs leading-5">
          {t("settings_repo_delete_card_note")}
        </CardDescription>
      </div>
      <DeleteRepoDialog
        id={id}
        name={name}
      />
    </Card>
  );
}
