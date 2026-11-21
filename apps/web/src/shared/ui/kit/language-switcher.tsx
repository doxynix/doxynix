"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";

import { FLAGS, LOCALE_LABEL_KEYS, LOCALES } from "@/shared/config/locales";
import { usePathname, useRouter } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/cn";
import { Card } from "@/shared/ui/core/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/core/select";

import { Spinner } from "../core/spinner";

const loadedFlags = new Map<string, boolean>();

export function Flag({ alt, src }: Readonly<{ alt: string; src: string }>) {
  const [loaded, setLoaded] = useState(loadedFlags.get(src) ?? false);

  return (
    <div className="relative h-3.5 w-5 shrink-0 overflow-hidden rounded-2xs">
      <Image
        alt={alt}
        className={cn(
          "object-cover transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0",
        )}
        fill
        onLoad={() => {
          loadedFlags.set(src, true);
          setLoaded(true);
        }}
        sizes="20px"
        src={src}
        unoptimized
      />
    </div>
  );
}

export function LanguageSwitcher() {
  const t = useTranslations("Dashboard");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const handleLanguageChange = (nextLocale: string) => {
    startTransition(() => {
      router.replace(pathname, { locale: nextLocale });
    });
  };

  return (
    <Card
      className="gap-3 px-6 py-4"
      size="compact"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <p className="font-medium text-sm">{t("settings_language_title")}</p>
          <p className="mt-0.5 text-muted-foreground text-xs">{t("settings_language_desc")}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Select
            disabled={isPending}
            onValueChange={handleLanguageChange}
            value={locale}
          >
            <SelectTrigger
              aria-label={tCommon("change_language")}
              className="w-52"
            >
              <SelectValue placeholder={t("settings_language_select_placeholder")} />
            </SelectTrigger>
            <SelectContent>
              {LOCALES.map((l) => (
                <SelectItem
                  key={l}
                  value={l}
                >
                  <div className="flex items-center gap-3">
                    <Flag
                      alt=""
                      src={FLAGS[l]}
                    />
                    <span>{t(LOCALE_LABEL_KEYS[l])}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isPending && <Spinner />}
        </div>
      </div>
    </Card>
  );
}
