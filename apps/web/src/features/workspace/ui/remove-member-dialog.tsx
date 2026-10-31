"use client";

import { useState } from "react";
import { UserMinus } from "lucide-react";
import { useTranslations } from "next-intl";

import { AppButton } from "@/shared/ui/core/button";
import { DangerActionDialog } from "@/shared/ui/kit/danger-action-dialog";

import { useMemberActions } from "../model/use-member-actions";

type Props = {
  memberName: string;
  userId: string;
};

export function RemoveMemberDialog({ memberName, userId }: Readonly<Props>) {
  const t = useTranslations("Dashboard");
  const tCommon = useTranslations("Common");
  const { remove } = useMemberActions();
  const [open, setOpen] = useState(false);

  return (
    <DangerActionDialog
      confirmLabel={tCommon("remove")}
      description={t("settings_members_remove_desc", { name: memberName })}
      isLoading={remove.isPending}
      onConfirm={() => remove.mutate({ userId }, { onSuccess: () => setOpen(false) })}
      onOpenChange={setOpen}
      open={open}
      title={t("settings_members_remove_title")}
      trigger={
        <AppButton
          aria-label={tCommon("remove")}
          size="icon"
          variant="ghost"
        >
          <UserMinus />
        </AppButton>
      }
    />
  );
}
