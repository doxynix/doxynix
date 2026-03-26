"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/shared/ui/core/button";

import { useCreateRepoActions } from "@/entities/repo";

export function CreateRepoButton() {
  const { setOpen } = useCreateRepoActions();
  const t = useTranslations("Dashboard");

  return (
    <Button variant="outline" onClick={() => setOpen(true)} className="cursor-pointer">
      <Plus /> {t("repo_add_repository")}
    </Button>
  );
}
