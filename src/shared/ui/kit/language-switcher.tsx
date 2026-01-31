"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";

import { Locale, LOCALES } from "@/shared/constants/locales";
import { cn, loadedFlags } from "@/shared/lib/utils";
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

const FLAGS: Record<Locale, string> = {
  en: "/icons/flags/us.svg",
  "zh-CN": "/icons/flags/cn.svg",
  "pt-BR": "/icons/flags/br.svg",
  ru: "/icons/flags/ru.svg",
  es: "/icons/flags/es.svg",
  de: "/icons/flags/de.svg",
  fr: "/icons/flags/fr.svg",
};

function Flag({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(loadedFlags.get(src) ?? false);

  return (
    <div className="relative h-3.5 w-5 shrink-0 overflow-hidden rounded-[2px]">
      <Image
        src={src}
        alt={alt}
        width={20}
        height={15}
        unoptimized
        className={cn(
          "h-full w-full object-cover transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0"
        )}
        onLoad={() => {
          loadedFlags.set(src, true);
          setLoaded(true);
        }}
      />
    </div>
  );
}

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
                  <div className="flex items-center gap-3">
                    <Flag src={FLAGS[l] || FLAGS.en} alt={l} />
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
