"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/shared/ui/core/button";

import { useCreateRepoDialogStore } from "../model/create-repo-dialog.store";

export function CreateRepoEmptyButton() {
  const openDialog = useCreateRepoDialogStore((s) => s.openDialog);
  const t = useTranslations("Common");

  return (
    <Button className="cursor-pointer" onClick={openDialog}>
      {t("add")}
    </Button>
  );
}
