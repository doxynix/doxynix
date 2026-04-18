"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/shared/ui/core/button";
import { DangerActionDialog } from "@/shared/ui/kit/danger-action-dialog";

import { useProfileActions } from "../model/use-profile-actions";

export function DeleteAccountDialog() {
  const [open, setOpen] = useState(false);
  const { deleteProfile } = useProfileActions();
  const t = useTranslations("Dashboard");

  const handleDelete = () => {
    deleteProfile.mutate(undefined, {
      onSuccess: () => setOpen(false),
    });
  };

  return (
    <DangerActionDialog
      confirmLabel={t("settings_danger_delete_confirmation")}
      description={t("settings_danger_delete_account_dialog_desc")}
      destructiveAlertContent={t("settings_danger_delete_account_alert_desc")}
      isLoading={deleteProfile.isPending}
      open={open}
      title={t("settings_danger_delete_account_dialog_title")}
      trigger={
        <Button variant="destructive" className="w-fit cursor-pointer">
          {t("settings_danger_delete_account_title")} <Trash2 />
        </Button>
      }
      onConfirm={handleDelete}
      onOpenChange={setOpen}
    />
  );
}
