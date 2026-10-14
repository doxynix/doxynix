import { getTranslations } from "next-intl/server";

import { createMetadata } from "@/shared/lib/metadata";

import { AdminAuditContainer } from "@/features/admin/ui/admin-audit-container";

export const generateMetadata = createMetadata("admin_audit_title", "admin_audit_desc");

export default async function AdminAuditPage() {
  const t = await getTranslations("AdminAudit");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-bold text-2xl tracking-tight">{t("page_title")}</h1>
        <p className="text-muted-foreground text-sm">{t("page_desc")}</p>
      </div>

      <AdminAuditContainer />
    </div>
  );
}
