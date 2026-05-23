"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import { AppButton } from "@/shared/ui/core/button";

import { useCreateRepoActions } from "@/entities/repo/model/use-create-repo-dialog.store";

export function CreateRepoButton() {
  const { setOpen } = useCreateRepoActions();
  const t = useTranslations("Dashboard");

  return (
    <AppButton variant="outline" onClick={() => setOpen(true)} className="cursor-pointer">
      <Plus /> {t("repo_add_repository")}
    </AppButton>
  );
}
