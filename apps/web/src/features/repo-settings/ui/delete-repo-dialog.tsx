"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { useRouter } from "@/shared/i18n/navigation";
import { AppButton } from "@/shared/ui/core/button";
import { DangerActionDialog } from "@/shared/ui/kit/danger-action-dialog";

import { useRepoActions } from "@/entities/repo/model/use-repo-actions";

type Props = { id: string };

export function DeleteRepoDialog({ id }: Readonly<Props>) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("Dashboard");
  const { deleteRepo } = useRepoActions();
  const router = useRouter();

  const handleDelete = () => {
    deleteRepo.mutate(
      { id },
      {
        onSuccess: () => {
          setOpen(false);
          router.push(`/dashboard/repos`);
        },
      },
    );
  };

  return (
    <DangerActionDialog
      confirmLabel={t("settings_danger_delete_confirmation")}
      description={t("settings_repo_delete_desc")}
      destructiveAlertContent={
        <span>
          {t("settings_repo_delete_irreversible_pre")}{" "}
          <strong>{t("settings_repo_delete_irreversible_strong")}</strong>{" "}
          {t("settings_repo_delete_irreversible_post")}
        </span>
      }
      isLoading={deleteRepo.isPending}
      onConfirm={handleDelete}
      onOpenChange={setOpen}
      open={open}
      successAlertContent={
        <span>
          {t("settings_repo_delete_safe_pre")}{" "}
          <strong>{t("settings_repo_delete_safe_strong")}</strong>{" "}
          {t("settings_repo_delete_safe_post")}
        </span>
      }
      successAlertTitle={t("settings_danger_alert_title")}
      title={t("settings_repo_delete_title")}
      trigger={
        <AppButton
          className="w-fit cursor-pointer"
          variant="destructive"
        >
          {t("settings_repo_delete_button")} <Trash2 />
        </AppButton>
      }
    />
  );
}
