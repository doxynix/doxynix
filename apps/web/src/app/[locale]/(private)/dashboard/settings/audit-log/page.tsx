import { getTranslations } from "next-intl/server";

import { createMetadata } from "@/shared/lib/metadata";

import { AuditLogsContainer } from "@/features/audit-logs/ui/audit-logs-container";

export const generateMetadata = createMetadata("audit_log_title", "audit_log_desc");

export default async function AuditLogPage() {
  const t = await getTranslations("AuditLogs");

  return (
    <div className="flex h-[calc(100vh-220px)] flex-col gap-6 overflow-hidden">
      <div className="flex flex-col gap-2">
        <h1 className="font-bold text-2xl tracking-tight">{t("page_title")}</h1>
        <p className="text-muted-foreground text-sm">{t("page_desc")}</p>
      </div>

      <AuditLogsContainer />
    </div>
  );
}
