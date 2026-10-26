import { getTranslations } from "next-intl/server";

import { AppearanceSettings } from "@/features/appearance/ui/appearance-settings";

export default async function AppearancePage() {
  const t = await getTranslations("Dashboard");

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="font-bold text-2xl tracking-tight">{t("settings_appearance_title")}</h2>
        <p className="text-muted-foreground text-sm">{t("settings_appearance_desc")}</p>
      </div>
      <AppearanceSettings />
    </div>
  );
}
