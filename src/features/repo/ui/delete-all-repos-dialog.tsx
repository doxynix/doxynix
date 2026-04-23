"use client";

import { useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/shared/ui/core/button";
import { DangerActionDialog } from "@/shared/ui/kit/danger-action-dialog";

import { useRepoActions } from "@/entities/repo";

const richStyles = {
  strong: (chunks: ReactNode) => <strong>{chunks}</strong>,
};

type Props = { hasRepos: boolean };

export function DeleteAllReposDialog({ hasRepos }: Readonly<Props>) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("Dashboard");
  const tsRich = (key: string) => t.rich(key, richStyles);
  const { deleteAll } = useRepoActions();

  const handleDelete = () => {
    deleteAll.mutate(undefined, {
      onSuccess: () => setOpen(false),
    });
  };

  return (
    <DangerActionDialog
      confirmLabel={t("settings_danger_delete_confirmation")}
      description={t("settings_danger_delete_all_repos_desc")}
      destructiveAlertContent={tsRich("settings_danger_delete_all_repos_note_4")}
      isLoading={deleteAll.isPending}
      open={open}
      successAlertContent={tsRich("settings_danger_delete_all_repos_note_3")}
      successAlertTitle={t("settings_danger_alert_title")}
      title={`${t("settings_danger_delete_all_repos")}?`}
      trigger={
        <Button disabled={!hasRepos} variant="destructive" className="w-fit cursor-pointer">
          {t("settings_danger_delete_all_repos")} <Trash2 className="size-4" />
        </Button>
      }
      onConfirm={handleDelete}
      onOpenChange={setOpen}
    />
  );
}
