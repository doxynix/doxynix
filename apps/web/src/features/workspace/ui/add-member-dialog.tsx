"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { formatShortDate } from "@/shared/lib/date-utils";
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
import { useSeatPreview } from "../model/use-seat-preview";

function formatPrice(cents: null | number, currency: null | string, locale: string): null | string {
  if (cents == null || currency == null) {
    return null;
  }

  try {
    return new Intl.NumberFormat(locale, {
      currency: currency.toUpperCase(),
      maximumFractionDigits: 2,
      style: "currency",
    }).format(cents / 100);
  } catch {
    return null;
  }
}

export function AddMemberDialog() {
  const t = useTranslations("Dashboard");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const { add } = useMemberActions();
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(false);
  const preview = useSeatPreview(open);

  const price = formatPrice(
    preview.data?.amountPerSeatCents ?? null,
    preview.data?.currency ?? null,
    locale,
  );
  const periodEnd = preview.data?.periodEnd ?? null;
  const needsCharge = preview.data?.needsCharge === true;

  // A seat is billed the moment the person is saved, so the price is stated before the click. The
  // preview is the only source of that number: the catalog deliberately does not store amounts.
  const costLine = () => {
    if (preview.isLoading) {
      return null;
    }

    if (!needsCharge) {
      return preview.isError || preview.data == null
        ? t("settings_members_add_cost_unknown")
        : t("settings_members_add_cost_free");
    }

    if (price != null && periodEnd != null) {
      return t("settings_members_add_cost", {
        date: formatShortDate(periodEnd, locale),
        price,
      });
    }

    return t("settings_members_add_cost_unknown");
  };

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
          <p className="text-muted-foreground text-xs">{costLine()}</p>
        </div>
        <DialogFooter>
          <AppButton
            onClick={() => setOpen(false)}
            variant="outline"
          >
            {tCommon("cancel")}
          </AppButton>
          <AppButton
            disabled={add.isPending || preview.isLoading || email.trim().length === 0}
            onClick={submit}
          >
            {needsCharge ? t("settings_members_add_pay") : t("settings_members_add")}
          </AppButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
