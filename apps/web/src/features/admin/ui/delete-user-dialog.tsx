"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { DangerActionDialog } from "@/shared/ui/kit/danger-action-dialog";

import type { AdminUser } from "@/entities/user/model/user.types";

import type { AdminUserActions } from "../model/use-admin-user-actions";
import { AdminTotpField } from "./admin-totp-field";

type Props = {
  actions: AdminUserActions;
  trigger: ReactNode;
  user: AdminUser;
};

export function DeleteUserDialog({ actions, trigger, user }: Readonly<Props>) {
  const t = useTranslations("AdminUsers");
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");

  return (
    <DangerActionDialog
      confirmationPhrase={user.email ?? user.id}
      confirmEnabled={code.length === 6}
      confirmLabel={t("delete_confirm_label")}
      description={t("delete_dialog_desc")}
      destructiveAlertContent={t("delete_dialog_alert")}
      isLoading={actions.deleteUser.isPending}
      onConfirm={() =>
        actions.deleteUser.mutate({ code, id: user.id }, { onSuccess: () => setOpen(false) })
      }
      onOpenChange={setOpen}
      open={open}
      title={t("delete_dialog_title", { name: user.name ?? user.email ?? user.id })}
      trigger={trigger}
    >
      <AdminTotpField
        onChange={setCode}
        value={code}
      />
    </DangerActionDialog>
  );
}
