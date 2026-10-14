"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/core/alert";
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
import { Textarea } from "@/shared/ui/core/textarea";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

import type { AdminUser } from "@/entities/user/model/user.types";

import type { AdminUserActions } from "../model/use-admin-user-actions";
import { AdminTotpField } from "./admin-totp-field";

type Props = {
  actions: AdminUserActions;
  trigger: ReactNode;
  user: AdminUser;
};

export function BanUserDialog({ actions, trigger, user }: Readonly<Props>) {
  const t = useTranslations("AdminUsers");
  const tCommon = useTranslations("Common");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [code, setCode] = useState("");

  const ban = () => {
    actions.setBanned.mutate(
      {
        banExpires: expiresAt || undefined,
        banned: true,
        banReason: reason.trim() || undefined,
        code,
        id: user.id,
      },
      { onSuccess: () => setOpen(false) },
    );
  };

  return (
    <Dialog
      onOpenChange={setOpen}
      open={open}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("ban_dialog_title", { name: user.name ?? user.email ?? user.id })}
          </DialogTitle>
          <DialogDescription>{t("ban_dialog_desc")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Alert variant="destructive">
            <AlertTitle>{tCommon("warning")}</AlertTitle>
            <AlertDescription>{t("ban_dialog_alert")}</AlertDescription>
          </Alert>

          <Label className="flex flex-col gap-2 ">
            {t("ban_reason_label")}
            <Textarea
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t("ban_reason_placeholder")}
              rows={3}
              value={reason}
            />
          </Label>

          <Label className="flex flex-col gap-2 ">
            {t("ban_expires_label")}
            <Input
              onChange={(event) => setExpiresAt(event.target.value)}
              type="datetime-local"
              value={expiresAt}
            />
            <span className="text-muted-foreground text-xs">{t("ban_expires_hint")}</span>
          </Label>

          <AdminTotpField
            onChange={setCode}
            value={code}
          />
        </div>

        <DialogFooter>
          <AppButton
            onClick={() => setOpen(false)}
            variant="outline"
          >
            {tCommon("cancel")}
          </AppButton>
          <LoadingButton
            disabled={code.length !== 6}
            isLoading={actions.setBanned.isPending}
            onClick={ban}
            variant="destructive"
          >
            {t("ban_confirm")}
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
