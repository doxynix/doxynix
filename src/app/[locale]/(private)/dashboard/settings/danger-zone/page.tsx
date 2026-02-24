import { getTranslations } from "next-intl/server";

import { createMetadata } from "@/shared/lib/metadata";

import { DeleteAccountCard, DeleteAllReposCard } from "@/features/danger-zone";

export const generateMetadata = createMetadata("danger_zone_title", "danger_zone_desc");

export default async function DangerZonePage() {
  const t = await getTranslations("Dashboard");

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex justify-between">
        <div className="flex flex-col gap-2">
          <h2 className="text-destructive text-2xl font-bold tracking-tight">
            {t("settings_danger_title")}
          </h2>
          <p className="text-muted-foreground text-sm">{t("settings_danger_desc")}</p>
        </div>
      </div>
      <DeleteAllReposCard />
      <DeleteAccountCard />
    </div>
  );
}
