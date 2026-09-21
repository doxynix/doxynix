import { getTranslations } from "next-intl/server";

import { createMetadata } from "@/shared/lib/metadata";

import { SessionsList } from "@/features/sessions/ui/sessions-list";

export const generateMetadata = createMetadata("sessions_title", "sessions_desc");

export default async function SessionsSettingsPage() {
  const t = await getTranslations("Sessions");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="font-bold text-2xl tracking-tight">{t("page_title")}</h1>
        <p className="text-muted-foreground text-sm">{t("page_desc")}</p>
      </div>

      <SessionsList />
    </div>
  );
}
