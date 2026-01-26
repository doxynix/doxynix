"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/core/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/core/select";

import { Locale, usePathname, useRouter } from "@/i18n/routing";
import { Spinner } from "../core/spinner";

type Language = { label: string; language: string };

export function LanguageSwitcher() {
  const t = useTranslations("Dashboard");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const handleLanguageChange = (nextLocale: string) => {
    startTransition(() => {
      router.replace(pathname, { locale: nextLocale as Locale });
    });
  };

  const LOCALES: Language[] = [
    { label: "en", language: t("settings_language_en") },
    { label: "ru", language: t("settings_language_ru") },
    { label: "de", language: t("settings_language_de") },
    { label: "es", language: t("settings_language_es") },
    { label: "zh-CN", language: t("settings_language_zh_cn") },
    { label: "pt-BR", language: t("settings_language_pt_br") },
    { label: "fr", language: t("settings_language_fr") },
  ];

  return (
    <div className="flex w-full flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("settings_language_title")}</CardTitle>
          <CardDescription>{t("settings_language_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          <Select value={locale} onValueChange={handleLanguageChange} disabled={isPending}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder={t("settings_language_select_placeholder")} />
            </SelectTrigger>
            <SelectContent>
              {LOCALES.map((item) => (
                <SelectItem value={item.label} key={item.label}>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase">{item.label}</span>
                    <span>{item.language}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isPending && <Spinner />}
        </CardContent>
      </Card>
    </div>
  );
}
