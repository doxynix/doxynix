import { getTranslations } from "next-intl/server";

import { createMetadata } from "@/shared/lib/metadata";

import { AdminBannedEmailsContainer } from "@/features/admin/ui/admin-banned-emails-container";

export const generateMetadata = createMetadata(
  "admin_banned_emails_title",
  "admin_banned_emails_desc",
);

export default async function AdminBannedEmailsPage() {
  const t = await getTranslations("AdminBannedEmails");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-bold text-2xl tracking-tight">{t("page_title")}</h1>
        <p className="text-muted-foreground text-sm">{t("page_desc")}</p>
      </div>

      <AdminBannedEmailsContainer />
    </div>
  );
}
