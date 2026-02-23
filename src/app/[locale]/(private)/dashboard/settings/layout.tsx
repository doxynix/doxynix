import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";

import { SettingsMenu } from "@/features/settings";

export default async function SettingsLayout({ children }: Readonly<{ children: ReactNode }>) {
  const t = await getTranslations("Dashboard");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("settings_title")}</h1>
      <div className="flex gap-12">
        <div className="flex flex-col gap-4">
          <SettingsMenu />
        </div>
        <div className="w-full">{children}</div>
      </div>
    </div>
  );
}
