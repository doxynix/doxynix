import { getTranslations } from "next-intl/server";

import { createMetadata } from "@/shared/lib/metadata";

export const generateMetadata = createMetadata("notifications_title", "notifications_desc");

export default async function NotificationsPage() {
  const t = await getTranslations("Dashboard");
  return <div className="">{t("notifications_placeholder")}</div>;
}
