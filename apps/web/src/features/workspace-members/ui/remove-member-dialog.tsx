"use client";

import { useState } from "react";
import { UserMinus } from "lucide-react";
import { useTranslations } from "next-intl";

import { AppButton } from "@/shared/ui/core/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/core/dialog";

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
    <Dialog
      onOpenChange={setOpen}
      open={open}
    >
      <DialogTrigger asChild>
        <AppButton
          aria-label={tCommon("remove")}
          size="icon"
          variant="ghost"
        >
          <UserMinus />
        </AppButton>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("settings_members_remove_title")}</DialogTitle>
          <DialogDescription>
            {t("settings_members_remove_desc", { name: memberName })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <AppButton
            onClick={() => setOpen(false)}
            variant="outline"
          >
            {tCommon("cancel")}
          </AppButton>
          <AppButton
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(
                { userId },
                {
                  onSuccess: () => setOpen(false),
                },
              )
            }
            variant="destructive"
          >
            {tCommon("remove")}
          </AppButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
