"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import { useCreateRepoDialogStore } from "@/shared/model/create-repo-dialog.store";
import { Button } from "@/shared/ui/core/button";

export function CreateRepoButton() {
  const openDialog = useCreateRepoDialogStore((s) => s.openDialog);
  const t = useTranslations("Dashboard");

  return (
    <Button className="cursor-pointer" variant="outline" onClick={openDialog}>
      <Plus /> {t("repo_add_repository")}
    </Button>
  );
}
