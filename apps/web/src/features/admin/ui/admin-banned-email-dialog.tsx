"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import {
  type BannedEmailReason,
  BannedEmailReason as BannedEmailReasonValues,
} from "@doxynix/shared";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/core/select";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

import type { BannedEmailActions } from "../model/use-banned-email-actions";

type Props = {
  actions: BannedEmailActions;
  trigger: ReactNode;
};

export function AdminBannedEmailDialog({ actions, trigger }: Readonly<Props>) {
  const t = useTranslations("AdminBannedEmails");
  const tCommon = useTranslations("Common");

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState<string>("MANUAL");

  const submit = () => {
    actions.create.mutate(
      { email: email.trim(), reason: reason as BannedEmailReason },
      {
        onSuccess: () => {
          setEmail("");
          setReason("MANUAL");
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
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("create_title")}</DialogTitle>
          <DialogDescription>{t("create_desc")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Label className="flex flex-col gap-2">
            {t("create_email_label")}
            <Input
              autoComplete="off"
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t("create_email_placeholder")}
              type="email"
              value={email}
            />
          </Label>

          <Label className="flex flex-col gap-2">
            {t("create_reason_label")}
            <Select
              onValueChange={setReason}
              value={reason}
            >
              <SelectTrigger aria-label={t("create_reason_label")}>
                <SelectValue placeholder={t("create_reason_label")} />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(BannedEmailReasonValues).map((value) => (
                  <SelectItem
                    key={value}
                    value={value}
                  >
                    {t(`reason_${value.toLowerCase()}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Label>
        </div>

        <DialogFooter>
          <AppButton
            onClick={() => setOpen(false)}
            variant="outline"
          >
            {tCommon("cancel")}
          </AppButton>
          <LoadingButton
            disabled={email.trim().length === 0}
            isLoading={actions.create.isPending}
            onClick={submit}
          >
            {t("create_confirm")}
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
