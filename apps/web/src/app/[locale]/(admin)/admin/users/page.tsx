import { getTranslations } from "next-intl/server";

import { createMetadata } from "@/shared/lib/metadata";

import { AdminUsersContainer } from "@/features/admin/ui/admin-users-container";

export const generateMetadata = createMetadata("admin_users_title", "admin_users_desc");

export default async function AdminUsersPage() {
  const t = await getTranslations("AdminUsers");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-bold text-2xl tracking-tight">{t("page_title")}</h1>
        <p className="text-muted-foreground text-sm">{t("page_desc")}</p>
      </div>

      <AdminUsersContainer />
    </div>
  );
}
