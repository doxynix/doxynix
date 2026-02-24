import { getLocale } from "next-intl/server";

import { createMetadata } from "@/shared/lib/metadata";
import { redirect } from "@/i18n/routing";

export const generateMetadata = createMetadata("settings_title", "settings_desc");

export default async function SettingsPage() {
  const locale = await getLocale();
  redirect({ href: "/dashboard/settings/profile", locale });
}
