"use client";

import { CircleOff } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/shared/ui/core/empty";

export function ApiKeysEmpty() {
  const t = useTranslations("Dashboard");
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CircleOff />
        </EmptyMedia>
        <EmptyTitle>{t("settings_api_keys_empty_title")}</EmptyTitle>
        <EmptyDescription>{t("settings_api_keys_empty_desc")}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
