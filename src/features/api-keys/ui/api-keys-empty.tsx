import { CircleOff } from "lucide-react";
import { getTranslations } from "next-intl/server";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/shared/ui/core/empty";

export async function ApiKeysEmpty() {
  const t = await getTranslations("Dashboard");
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
