"use client";

import { useState } from "react";
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
import { Input } from "@/shared/ui/core/input";
import { Label } from "@/shared/ui/core/label";

import { useMemberActions } from "../model/use-member-actions";

export function AddMemberDialog() {
  const t = useTranslations("Dashboard");
  const tCommon = useTranslations("Common");
  const { add } = useMemberActions();
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(false);

  const submit = () => {
    const normalized = email.trim();

    if (normalized.length === 0) {
      return;
    }

    add.mutate(
      { email: normalized },
      {
        onSuccess: () => {
          setEmail("");
          setOpen(false);
        },
      },
    );
  };

  return (
    <Dialog
      onOpenChange={setOpen}
      open={open}
    >
      <DialogTrigger asChild>
        <AppButton>{t("settings_members_add")}</AppButton>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("settings_members_add_title")}</DialogTitle>
          <DialogDescription>{t("settings_members_add_desc")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="workspace-member-email">{t("settings_members_add_email_label")}</Label>
          <Input
            id="workspace-member-email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t("settings_members_add_email_placeholder")}
            type="email"
            value={email}
          />
        </div>
        <DialogFooter>
          <AppButton
            onClick={() => setOpen(false)}
            variant="outline"
          >
            {tCommon("cancel")}
          </AppButton>
          <AppButton
            disabled={add.isPending || email.trim().length === 0}
            onClick={submit}
          >
            {t("settings_members_add")}
          </AppButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
