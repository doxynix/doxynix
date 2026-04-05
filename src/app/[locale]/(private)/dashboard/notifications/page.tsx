import { getTranslations } from "next-intl/server";

import { createMetadata } from "@/shared/lib/metadata";

import { NotificationsListContainer } from "@/features/notifications";

export const generateMetadata = createMetadata("notifications_title", "notifications_desc");

export default async function NotificationsPage() {
  const t = await getTranslations("Dashboard");

  return (
    <div className="flex h-full w-full flex-col gap-4">
      <h1 className="text-2xl font-bold">{t("notifications_title")}</h1>
      <NotificationsListContainer />
    </div>
  );
}
