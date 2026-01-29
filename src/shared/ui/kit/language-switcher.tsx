"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Locale, LOCALES } from "@/shared/constants/locales";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/core/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/core/select";

import { usePathname, useRouter } from "@/i18n/routing";
import { Spinner } from "../core/spinner";

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
  const translationKeys = LOCALES.map(
    (l) => `settings_language_${l.toLowerCase().replace("-", "_")}` as const
  );

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
              {LOCALES.map((l, i) => (
                <SelectItem value={l} key={l}>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-[10px] font-bold uppercase">
                      {l}
                    </span>
                    <span>{t(translationKeys[i])}</span>
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
