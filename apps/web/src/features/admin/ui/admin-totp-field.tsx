"use client";

import { useTranslations } from "next-intl";

import { Input } from "@/shared/ui/core/input";
import { Label } from "@/shared/ui/core/label";

type Props = {
  onChange: (value: string) => void;
  value: string;
};

export function AdminTotpField({ onChange, value }: Readonly<Props>) {
  const t = useTranslations("AdminUsers");

  return (
    <Label className="flex flex-col gap-2">
      {t("reauth_code_label")}
      <Input
        autoComplete="one-time-code"
        inputMode="numeric"
        maxLength={6}
        onChange={(event) => onChange(event.target.value.replaceAll(/\D/g, ""))}
        placeholder={t("reauth_code_placeholder")}
        value={value}
      />
      <span className="text-muted-foreground text-xs">{t("reauth_code_hint")}</span>
    </Label>
  );
}
